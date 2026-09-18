/**
 * Test Helpers and Utilities
 * 
 * Common utilities for test setup, assertion helpers, and test data generation.
 * 
 * @module test-utils/test-helpers
 */

/**
 * Wait for a specified number of milliseconds (useful for async testing)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true with timeout
 * Useful for testing async state changes
 * 
 * @param condition - Function that returns boolean
 * @param timeout - Max wait time in ms (default 5000)
 * @param checkInterval - Interval between checks in ms (default 100)
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  checkInterval = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }
    await delay(checkInterval);
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Capture calls to a mock function and return them
 */
export function getCalls<T extends (...args: any[]) => any>(
  mockFn: jest.Mock<T>,
): Parameters<T>[] {
  return mockFn.mock.calls;
}

/**
 * Get the last call arguments of a mock function
 */
export function getLastCall<T extends (...args: any[]) => any>(
  mockFn: jest.Mock<T>,
): Parameters<T> | undefined {
  const calls = mockFn.mock.calls;
  return calls[calls.length - 1];
}

/**
 * Assert that a mock was called with specific arguments
 */
export function expectCalledWith<T extends (...args: any[]) => any>(
  mockFn: jest.Mock<T>,
  ...expectedArgs: Parameters<T>
): void {
  expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
}

/**
 * Create a spy on console methods (useful for testing logging)
 */
export function spyOnConsole(method: 'log' | 'error' | 'warn' | 'debug'): jest.SpyInstance {
  return jest.spyOn(console, method).mockImplementation(() => {});
}

/**
 * Restore all console spies
 */
export function restoreConsoleSpy(): void {
  jest.restoreAllMocks();
}

/**
 * Generate a random UUID for testing
 */
export function generateTestUUID(): string {
  return `test-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a random email for testing
 */
export function generateTestEmail(): string {
  return `test-${Math.random().toString(36).substr(2, 9)}@test.com`;
}

/**
 * Deep clone an object (useful for test data isolation)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Assert that an error was thrown with a specific message
 */
export async function expectToThrow(
  fn: () => Promise<any>,
  expectedMessage?: string | RegExp,
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (expectedMessage) {
      if (typeof expectedMessage === 'string') {
        expect((error as Error).message).toContain(expectedMessage);
      } else {
        expect((error as Error).message).toMatch(expectedMessage);
      }
    }
  }
}

/**
 * Mock a Date for testing time-dependent code
 */
export function mockDate(isoDate: string): jest.SpyInstance {
  const mockDate = new Date(isoDate);
  return jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
}

/**
 * Restore the real Date after mocking
 */
export function restoreDate(): void {
  jest.restoreAllMocks();
}

/**
 * Create a test suite context object that can be shared across tests
 */
export function createTestContext<T extends Record<string, any>>(): {
  context: T;
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  get: <K extends keyof T>(key: K) => T[K];
  clear: () => void;
} {
  const context = {} as T;

  return {
    context,
    set: (key, value) => {
      context[key] = value;
    },
    get: (key) => context[key],
    clear: () => {
      Object.keys(context).forEach((key) => delete context[key]);
    },
  };
}

/**
 * Assert that an object matches a partial subset
 * Useful for testing objects with many properties
 */
export function expectToMatchPartial<T>(
  actual: T,
  expected: Partial<T>,
): void {
  Object.keys(expected).forEach((key) => {
    expect((actual as any)[key]).toEqual((expected as any)[key]);
  });
}

/**
 * Create a deferred promise for controlling async flow in tests
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Flush all pending promises (useful for testing async code)
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
