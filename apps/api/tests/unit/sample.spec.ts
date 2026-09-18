/**
 * Sample Test Suite
 * 
 * This is a demonstration test file showing testing patterns and best practices.
 * Use this as a reference when writing new tests.
 */

import {
  createMockAgentContext,
  createMockChatResult,
  mockAgentContext,
  waitFor,
  delay,
  expectToThrow,
  generateTestUUID,
} from '../utils';

describe('Sample Test Suite', () => {
  describe('Mock Factories', () => {
    it('should create mock agent context', () => {
      const context = createMockAgentContext();
      
      expect(context).toBeDefined();
      expect(context.task).toBe('Test task');
      expect(context.projectId).toBe('project-456');
    });

    it('should create mock agent context with overrides', () => {
      const context = createMockAgentContext({
        task: 'Custom task',
        projectId: 'custom-project',
      });
      
      expect(context.task).toBe('Custom task');
      expect(context.projectId).toBe('custom-project');
    });

    it('should use builder pattern for complex mocks', () => {
      const context = mockAgentContext()
        .withTask('Build feature')
        .withProjectId('proj-123')
        .withGoal('Deliver value')
        .build();
      
      expect(context.task).toBe('Build feature');
      expect(context.projectContext?.goal).toBe('Deliver value');
    });
  });

  describe('Test Helpers', () => {
    it('should wait for async condition', async () => {
      let counter = 0;
      const incrementAsync = () => {
        setTimeout(() => counter++, 50);
      };
      
      incrementAsync();
      await waitFor(() => counter > 0, 200, 10);
      
      expect(counter).toBe(1);
    });

    it('should delay execution', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('should assert error thrown', async () => {
      const throwError = async () => {
        throw new Error('Expected error');
      };
      
      await expectToThrow(throwError, 'Expected error');
    });

    it('should generate test UUID', () => {
      const uuid = generateTestUUID();
      
      expect(uuid).toMatch(/^test-[a-z0-9]+$/);
    });
  });

  describe('Mocking Patterns', () => {
    it('should mock function with return value', () => {
      const mockFn = jest.fn().mockReturnValue('mocked value');
      
      const result = mockFn();
      
      expect(result).toBe('mocked value');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should mock async function', async () => {
      const mockAsyncFn = jest.fn().mockResolvedValue('async result');
      
      const result = await mockAsyncFn();
      
      expect(result).toBe('async result');
      expect(mockAsyncFn).toHaveBeenCalled();
    });

    it('should verify mock call arguments', () => {
      const mockFn = jest.fn();
      
      mockFn('arg1', 'arg2');
      
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should use object matching', () => {
      const mockFn = jest.fn();
      
      mockFn({ id: '123', name: 'Test' });
      
      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
        })
      );
    });
  });

  describe('Arrange-Act-Assert Pattern', () => {
    class Calculator {
      add(a: number, b: number): number {
        return a + b;
      }
    }

    it('should follow AAA pattern', () => {
      // Arrange
      const calculator = new Calculator();
      const a = 5;
      const b = 3;
      
      // Act
      const result = calculator.add(a, b);
      
      // Assert
      expect(result).toBe(8);
    });
  });

  describe('Snapshot Testing', () => {
    it('should match snapshot', () => {
      const data = {
        id: '123',
        name: 'Test Object',
        metadata: {
          createdAt: '2026-09-18',
          version: '1.0.0',
        },
      };
      
      expect(data).toMatchSnapshot();
    });
  });

  describe('Error Handling', () => {
    it('should catch and verify error', () => {
      const throwError = () => {
        throw new Error('Something went wrong');
      };
      
      expect(throwError).toThrow('Something went wrong');
    });

    it('should test async error', async () => {
      const asyncError = async () => {
        throw new Error('Async error');
      };
      
      await expect(asyncError()).rejects.toThrow('Async error');
    });
  });
});
