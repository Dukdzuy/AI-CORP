# Test Suite Documentation

## Overview

This directory contains the comprehensive test suite for the AI Corp Platform API, organized following TDD (Test-Driven Development) principles and OOAD (Object-Oriented Analysis and Design) patterns.

## Directory Structure

```
tests/
├── unit/                 # Unit tests for individual classes/functions
│   ├── domain/          # Domain layer tests (Agents, Tools, etc.)
│   ├── application/     # Application layer tests (Use cases, Services)
│   └── infrastructure/  # Infrastructure tests (Repositories, Adapters)
├── integration/         # Integration tests for module interactions
│   ├── agents/          # Agent integration tests
│   ├── workflows/       # Workflow integration tests
│   └── tools/           # Tool execution integration tests
├── e2e/                 # End-to-end tests for complete workflows
│   ├── project-creation/
│   ├── agent-execution/
│   └── workflow-execution/
└── utils/               # Test utilities and mock factories
    ├── index.ts         # Central export
    ├── test-helpers.ts  # Helper functions
    └── mock-factories.ts # Mock object factories
```

## Test Coverage Requirements

**Target: 90% coverage across all metrics**

- **Branches**: 90%
- **Functions**: 90%
- **Lines**: 90%
- **Statements**: 90%

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm test -- tests/unit
```

### Integration Tests Only
```bash
npm test -- tests/integration
```

### E2E Tests Only
```bash
npm test -- tests/e2e
```

### Watch Mode
```bash
npm test:watch
```

### Coverage Report
```bash
npm test -- --coverage
```

## Writing Tests (TDD Approach)

### 1. Write Test First
Before implementing any code, write the test that defines the expected behavior:

```typescript
// tests/unit/domain/agent/AgentStateMachine.spec.ts
describe('AgentStateMachine', () => {
  it('should allow valid state transitions', () => {
    // Arrange
    const stateMachine = new AgentStateMachine();
    
    // Act
    const canTransition = stateMachine.canTransitionTo(AgentState.THINKING);
    stateMachine.transitionTo(AgentState.THINKING);
    
    // Assert
    expect(canTransition).toBe(true);
    expect(stateMachine.getCurrentState()).toBe(AgentState.THINKING);
  });
});
```

### 2. Run Test (Should Fail)
```bash
npm test -- AgentStateMachine.spec.ts
# Expected: FAIL - AgentStateMachine is not defined
```

### 3. Implement Minimum Code
Write just enough code to make the test pass:

```typescript
// src/domain/agent/AgentStateMachine.ts
export class AgentStateMachine {
  private currentState = AgentState.IDLE;
  
  canTransitionTo(newState: AgentState): boolean {
    // Minimum implementation
    return true;
  }
  
  transitionTo(newState: AgentState): void {
    this.currentState = newState;
  }
  
  getCurrentState(): AgentState {
    return this.currentState;
  }
}
```

### 4. Run Test (Should Pass)
```bash
npm test -- AgentStateMachine.spec.ts
# Expected: PASS
```

### 5. Refactor
Improve the code while keeping tests green.

## Test Utilities

### Mock Factories

Use mock factories from `tests/utils/mock-factories.ts` to create test data:

```typescript
import { 
  createMockAgentContext, 
  createMockChatResult,
  mockAgentContext 
} from '../utils';

// Simple mock
const context = createMockAgentContext();

// Builder pattern for complex mocks
const context = mockAgentContext()
  .withTask('Implement feature X')
  .withProjectId('project-123')
  .withGoal('Build amazing product')
  .build();
```

### Test Helpers

```typescript
import { waitFor, delay, expectToThrow } from '../utils';

// Wait for async condition
await waitFor(() => agent.getState() === AgentState.COMPLETED);

// Delay execution
await delay(100);

// Assert error thrown
await expectToThrow(
  async () => agent.execute(invalidContext),
  'Invalid context'
);
```

## Mocking Best Practices

### 1. Mock External Dependencies
Always mock external services (LLM, Database, Docker):

```typescript
const mockLLM = createMockLLMProvider();
mockLLM.chat.mockResolvedValue(createMockChatResult({
  content: 'Expected response'
}));
```

### 2. Spy on Internal Methods
Use Jest spies to verify internal behavior:

```typescript
const spy = jest.spyOn(agent, 'emitEvent');
await agent.execute(context);
expect(spy).toHaveBeenCalledWith('stateChanged');
```

### 3. Verify Mock Calls
```typescript
expect(mockMemoryService.saveMemory).toHaveBeenCalledTimes(1);
expect(mockMemoryService.saveMemory).toHaveBeenCalledWith(
  expect.objectContaining({
    agentRole: AgentRole.CEO,
    namespace: 'strategy'
  })
);
```

## Test Naming Conventions

### Test Files
- Unit tests: `<ClassName>.spec.ts`
- Integration tests: `<Feature>.integration.spec.ts`
- E2E tests: `<Workflow>.e2e.spec.ts`

### Test Descriptions
Use behavior-driven descriptions:

```typescript
describe('CeoThinkingStrategy', () => {
  describe('think()', () => {
    it('should generate strategic milestones from project goal', async () => {
      // ...
    });
    
    it('should load relevant memories before reasoning', async () => {
      // ...
    });
    
    it('should throw error when LLM call fails', async () => {
      // ...
    });
  });
});
```

## Coverage Exclusions

The following are excluded from coverage requirements:
- Module files (`*.module.ts`)
- Interface definitions (`*.interface.ts`)
- Type definitions (`*.types.ts`, `*.enum.ts`)
- Index files (`index.ts`)
- Main entry point (`main.ts`)

## CI/CD Integration

Tests run automatically on:
- Every commit to `feature/ooad-refactor` branch
- Pull requests to `master`
- Pre-push hooks

Builds will fail if:
- Any test fails
- Coverage drops below 90% threshold
- Linting errors exist

## Debugging Tests

### Run Single Test File
```bash
npm test -- path/to/test.spec.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should allow valid state transitions"
```

### Debug in VS Code
Add breakpoint, then press F5 or use "Jest Debug" configuration.

### Verbose Output
```bash
npm test -- --verbose
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [TDD Cycle](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

## Questions?

For questions about testing strategy, contact the development team or refer to the OOAD implementation plan.
