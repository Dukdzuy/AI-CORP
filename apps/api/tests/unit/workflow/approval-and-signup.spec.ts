jest.mock('../../../src/modules/workflow/workflow.engine', () => ({ WorkflowEngine: class {} }));

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApprovalService } from '../../../src/modules/approvals/approval.service';
import { AppWebSocketGateway } from '../../../src/modules/websocket/websocket.gateway';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { jwtExpirationSeconds, signupRole } from '../../../src/modules/security/runtime-config';

/** Review fixes (2026-10-30): approvals land once, sign-up is safe by default, project rooms join */
describe('ApprovalService.handleApprovalResponse', () => {
  function setup(status = 'pending') {
    const approval = { id: 'a1', workflowRunId: 'run-1', userId: 'u1', status, comment: null };
    const prisma = {
      approval: {
        findUnique: jest.fn().mockResolvedValue(approval),
        updateMany: jest.fn().mockResolvedValue({ count: status === 'pending' ? 1 : 0 }),
      },
    };
    const engine = {
      recordApprovalDecision: jest.fn().mockResolvedValue(undefined),
      resumeWorkflow: jest.fn().mockResolvedValue(undefined),
      transitionToNextNode: jest.fn().mockResolvedValue(undefined),
      processCurrentNode: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ApprovalService(prisma as any, engine as any, {} as any, { publish: jest.fn() } as any);
    return { service, prisma, engine };
  }

  it('records the reason for the agents and continues down the matching edge', async () => {
    const { service, prisma, engine } = setup();
    await service.handleApprovalResponse('a1', 'rejected', 'Missing tests');

    expect(prisma.approval.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1', status: 'pending' } }));
    expect(engine.recordApprovalDecision).toHaveBeenCalledWith('run-1', 'rejected', 'Missing tests');
    expect(engine.transitionToNextNode).toHaveBeenCalledWith('run-1', 'onReject');
  });

  it('answers a second click with 409 and does not move the run again', async () => {
    const { service, engine } = setup('approved');
    await expect(service.handleApprovalResponse('a1', 'approved')).rejects.toThrow(ConflictException);
    expect(engine.resumeWorkflow).not.toHaveBeenCalled();
  });

  it('answers an unknown approval with 404', async () => {
    const { service, prisma } = setup();
    prisma.approval.findUnique.mockResolvedValue(null);
    await expect(service.handleApprovalResponse('nope', 'approved')).rejects.toThrow(NotFoundException);
  });
});

describe('Sign-up', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('gives a self-registered account the viewer role unless SIGNUP_ROLE says board_member', () => {
    expect(signupRole({})).toBe('viewer');
    expect(signupRole({ SIGNUP_ROLE: 'admin' })).toBe('viewer');
    expect(signupRole({ SIGNUP_ROLE: 'board_member' })).toBe('board_member');
  });

  it('is refused when ALLOW_REGISTRATION=false', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    const auth = new AuthService({ isReady: () => true } as any, {} as any);
    await expect(auth.register({ email: 'a@b.c', name: 'A', password: 'secret123' } as any)).rejects.toThrow(ForbiddenException);
  });

  it('keeps a sign-in for JWT_EXPIRATION seconds, 8 hours by default', () => {
    expect(jwtExpirationSeconds({})).toBe(8 * 60 * 60);
    expect(jwtExpirationSeconds({ JWT_EXPIRATION: '3600' })).toBe(3600);
  });
});

describe('AppWebSocketGateway project rooms', () => {
  it('joins the room for { projectId } (what the web app sends) and for a bare id', () => {
    const gateway = new AppWebSocketGateway();
    const client = { id: 'c1', join: jest.fn(), leave: jest.fn() };

    expect(gateway.handleSubscribeProject(client as any, { projectId: 'p1' })).toEqual(expect.objectContaining({ status: 'success' }));
    gateway.handleSubscribeProject(client as any, 'p2');
    gateway.handleUnsubscribeProject(client as any, { projectId: 'p1' });

    expect(client.join.mock.calls).toEqual([['p1'], ['p2']]);
    expect(client.leave).toHaveBeenCalledWith('p1');
  });
});
