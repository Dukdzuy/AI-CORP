import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AgentRole } from '@ai-corp/shared-types';
import { AGENT_CLASSES, AGENTS, agentsProvider } from '../../../src/modules/agents/agents.registry';
import { BaseAgent } from '../../../src/modules/agents/base.agent';
import { RoleProfile } from '../../../src/modules/agents/profiles';
import { AgentOrchestratorService } from '../../../src/modules/orchestrator/agent-orchestrator.service';
import { AgentMessageService } from '../../../src/modules/orchestrator/agent-message.service';
import { AppWebSocketGateway } from '../../../src/modules/websocket/websocket.gateway';
import { EventBus } from '../../../src/domain/events/EventBus';
import { IAgent } from '../../../src/domain/agent/interfaces/IAgent.interface';
import * as strategies from '../../../src/modules/agents/strategies';
import { createMockAgentContext } from '../../utils';

const TEST_PROFILE = RoleProfile.create({
  role: 'TEST' as AgentRole,
  displayName: 'Test Agent',
  systemPrompt: 'You are a test agent.',
  defaultModel: { provider: 'mock', model: 'mock' },
  memoryNamespaces: ['test'],
  taskTypes: ['probe'],
});

@Injectable()
class TestThinking {
  think = jest.fn().mockResolvedValue({ reasoning: 'probing', plannedActions: [], confidence: 1 });
}

@Injectable()
class TestAction {
  act = jest.fn().mockResolvedValue({ success: true, output: { action: 'probe', output: 'ok' } });
}

/** A 9th role, added only through its profile, strategies and one provider entry */
@Injectable()
class TestAgent extends BaseAgent {
  constructor(thinking: TestThinking, action: TestAction, ws: AppWebSocketGateway, eventBus: EventBus) {
    super(TEST_PROFILE, thinking, action, ws, eventBus);
  }
}

describe('Agent registry (AGENTS token)', () => {
  const ws = { sendToProject: jest.fn(), broadcastEvent: jest.fn() };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
  const messages = { sendMessage: jest.fn().mockResolvedValue(undefined) };

  // Every strategy class is replaced by a stub with the same DI token
  const strategyStubs = Object.values(strategies)
    .filter((s): s is any => typeof s === 'function')
    .map(s => ({ provide: s, useValue: { think: jest.fn(), act: jest.fn() } }));

  async function build(extraProviders: any[] = [], classes = AGENT_CLASSES) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...strategyStubs,
        { provide: AppWebSocketGateway, useValue: ws },
        { provide: EventBus, useValue: eventBus },
        { provide: AgentMessageService, useValue: messages },
        ...classes,
        ...extraProviders,
        agentsProvider(classes),
        AgentOrchestratorService,
      ],
    }).compile();
    return moduleRef;
  }

  it('resolves all 8 roles from the token', async () => {
    const moduleRef = await build();
    const agents = moduleRef.get<IAgent[]>(AGENTS);
    const orchestrator = moduleRef.get(AgentOrchestratorService);

    expect(agents).toHaveLength(8);
    expect(orchestrator.getAvailableRoles().sort()).toEqual(
      ['ARCHITECT', 'BA', 'CEO', 'DEV', 'MARKETING', 'PM', 'QA', 'QC']
    );
    expect(orchestrator.hasAgent('DEVOPS')).toBe(false);
  });

  it('rejects an unknown role and lists the available roles', async () => {
    const orchestrator = (await build()).get(AgentOrchestratorService);
    await expect(orchestrator.invokeAgent('DEVOPS', createMockAgentContext())).rejects.toThrow(
      /Unsupported agent role: DEVOPS\. Available roles: .*CEO.*QC/
    );
  });

  it('runs a new TestAgent added through the token without touching the orchestrator', async () => {
    const moduleRef = await build([TestThinking, TestAction], [...AGENT_CLASSES, TestAgent]);
    const orchestrator = moduleRef.get(AgentOrchestratorService);

    expect(orchestrator.getAvailableRoles()).toHaveLength(9);
    const result = await orchestrator.invokeAgent('TEST', createMockAgentContext({ taskType: 'probe' }));

    expect(result.action).toEqual({ success: true, output: { action: 'probe', output: 'ok' } });
    expect(moduleRef.get(TestAction).act).toHaveBeenCalledWith(expect.objectContaining({ taskType: 'probe' }), expect.anything());
    expect(messages.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ fromRole: 'TEST' }));
  });

  it('refuses two agents for the same role', () => {
    const fake = (role: string) => ({ getRole: () => role }) as unknown as IAgent;
    expect(() => new AgentOrchestratorService([fake('CEO'), fake('CEO')], messages as any)).toThrow(/Duplicate agent registered for role CEO/);
  });
});
