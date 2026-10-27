import { AgentRole } from '@ai-corp/shared-types';
import { BaseAgent } from '../../../src/modules/agents/base.agent';
import { CEO_PROFILE } from '../../../src/modules/agents/profiles';
import { AgentState } from '../../../src/domain/agent/AgentState';
import { StateChangedEvent } from '../../../src/domain/agent/interfaces/IAgentObserver.interface';
import { TaskAssignedEvent } from '../../../src/domain/events/TaskAssignedEvent';
import { TaskCompletedEvent } from '../../../src/domain/events/TaskCompletedEvent';
import { AgentErrorEvent } from '../../../src/domain/events/AgentErrorEvent';
import { createMockAgentContext } from '../../utils';

class CeoLikeAgent extends BaseAgent {}

describe('BaseAgent.execute()', () => {
  const thought = { reasoning: 'thinking', plannedActions: [{ toolName: 'llm', parameters: {}, rationale: 'r' }], confidence: 0.9 };
  const action = { success: true, output: { action: 'planMilestones', output: '1. M1' } };

  function setup(act: jest.Mock = jest.fn().mockResolvedValue(action)) {
    const thinking = { think: jest.fn().mockResolvedValue(thought) };
    const acting = { act };
    const ws = { sendToProject: jest.fn(), broadcastEvent: jest.fn() };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const agent = new CeoLikeAgent(CEO_PROFILE, thinking, acting, ws as any, eventBus as any);
    const states: Array<[AgentState, AgentState]> = [];
    const observer = {
      onStateChanged: (e: StateChangedEvent) => states.push([e.previousState, e.currentState]),
      onThinkingCompleted: jest.fn(),
      onActionCompleted: jest.fn(),
      onError: jest.fn(),
    };
    agent.addEventListener(observer);
    return { agent, thinking, acting, ws, eventBus, states, observer };
  }

  it('identifies itself through its role profile', () => {
    const { agent } = setup();
    expect(agent.getRole()).toBe(AgentRole.CEO);
    expect(agent.getId()).toBe('CEO');
    expect(agent.getProfile()).toBe(CEO_PROFILE);
    expect(agent.getState()).toBe(AgentState.IDLE);
  });

  it('walks IDLE → THINKING → ACTING → COMPLETED → IDLE and returns thought + action', async () => {
    const { agent, states, observer, ws } = setup();
    const result = await agent.execute(createMockAgentContext());

    expect(result).toEqual({ thought, action });
    expect(states).toEqual([
      [AgentState.IDLE, AgentState.THINKING],
      [AgentState.THINKING, AgentState.ACTING],
      [AgentState.ACTING, AgentState.COMPLETED],
      [AgentState.COMPLETED, AgentState.IDLE],
    ]);
    expect(agent.getState()).toBe(AgentState.IDLE);
    expect(observer.onThinkingCompleted).toHaveBeenCalledWith(expect.objectContaining({ thought, taskId: 'task-123' }));
    expect(observer.onActionCompleted).toHaveBeenCalledWith(expect.objectContaining({ result: action, actionType: 'planMilestones' }));
    expect(ws.sendToProject).toHaveBeenCalledWith('project-456', expect.objectContaining({ type: 'agent:thinking' }));
  });

  it('publishes TaskAssigned and TaskCompleted domain events', async () => {
    const { agent, eventBus } = setup();
    await agent.execute(createMockAgentContext({ priority: 'high' }));

    const events = eventBus.publish.mock.calls.map(c => c[0]);
    expect(events[0]).toBeInstanceOf(TaskAssignedEvent);
    expect(events[0]).toEqual(expect.objectContaining({ agentRole: 'CEO', priority: 'high' }));
    expect(events.some(e => e instanceof TaskCompletedEvent)).toBe(true);
  });

  it('hands the strategies a task type the role supports', async () => {
    const { agent, thinking, acting } = setup();

    await agent.execute(createMockAgentContext({ taskType: 'complete_project' }));
    expect(acting.act.mock.calls[0][0].taskType).toBe('complete_project');

    await agent.execute(createMockAgentContext({ taskType: 'implement_feature' }));
    expect(thinking.think.mock.calls[1][0].taskType).toBe('planMilestones');

    await agent.execute(createMockAgentContext());
    expect(acting.act.mock.calls[2][0].taskType).toBe('planMilestones');
  });

  it('stays in ERROR after a permanent failure and publishes AgentErrorEvent', async () => {
    const { agent, states, observer, eventBus } = setup(jest.fn().mockRejectedValue(new Error('Invalid API key')));

    await expect(agent.execute(createMockAgentContext())).rejects.toThrow('Invalid API key');
    expect(states[states.length - 1]).toEqual([AgentState.ACTING, AgentState.ERROR]);
    expect(agent.getState()).toBe(AgentState.ERROR);
    expect(observer.onError).toHaveBeenCalledWith(expect.objectContaining({ context: expect.objectContaining({ currentState: AgentState.ACTING }) }));
    expect(eventBus.publish.mock.calls.map(c => c[0]).some(e => e instanceof AgentErrorEvent)).toBe(true);
  });

  it('runs tasks of concurrent workflow runs side by side (one lifecycle per task, Phase 6 fix)', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const act = jest.fn().mockImplementationOnce(async () => { await gate; return action; }).mockResolvedValue(action);
    const { agent } = setup(act);

    const slow = agent.execute(createMockAgentContext({ taskId: 'slow' }));
    await new Promise(r => setImmediate(r));
    expect(agent.getState()).toBe(AgentState.ACTING);
    await expect(agent.execute(createMockAgentContext({ taskId: 'fast' }))).resolves.toEqual({ thought, action });
    expect(agent.getState()).toBe(AgentState.ACTING); // the slow task is still running
    release();
    await expect(slow).resolves.toEqual({ thought, action });
    expect(agent.getState()).toBe(AgentState.IDLE);
  });

  it('a permanent failure does not block the next task of the role', async () => {
    const act = jest.fn().mockRejectedValueOnce(new Error('Invalid API key')).mockResolvedValueOnce(action);
    const { agent } = setup(act);
    await expect(agent.execute(createMockAgentContext())).rejects.toThrow('Invalid API key');
    expect(agent.getState()).toBe(AgentState.ERROR);
    await expect(agent.execute(createMockAgentContext())).resolves.toEqual({ thought, action });
    expect(agent.getState()).toBe(AgentState.IDLE);
  });

  it('resets to IDLE after a transient failure so it can be retried', async () => {
    const act = jest.fn().mockRejectedValueOnce(new Error('Request timeout')).mockResolvedValueOnce(action);
    const { agent, states } = setup(act);

    await expect(agent.execute(createMockAgentContext())).rejects.toThrow('Request timeout');
    expect(states.slice(-2)).toEqual([[AgentState.ACTING, AgentState.ERROR], [AgentState.ERROR, AgentState.IDLE]]);

    await expect(agent.execute(createMockAgentContext())).resolves.toEqual({ thought, action });
  });

  it('does not fail the task when publishing a domain event fails', async () => {
    const { agent, eventBus } = setup();
    eventBus.publish.mockRejectedValue(new Error('bus down'));
    await expect(agent.execute(createMockAgentContext())).resolves.toEqual({ thought, action });
  });

  it('removes observers on removeEventListener and on module destroy', async () => {
    const { agent, observer } = setup();
    agent.removeEventListener(observer);
    await agent.execute(createMockAgentContext());
    expect(observer.onThinkingCompleted).not.toHaveBeenCalled();

    const other = { onStateChanged: jest.fn() };
    agent.addEventListener(other);
    agent.onModuleDestroy();
    await agent.execute(createMockAgentContext());
    expect(other.onStateChanged).not.toHaveBeenCalled();
  });
});
