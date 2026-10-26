/**
 * Raised when a principal lacks a permission or does not own the resource it acts on.
 * Mapped to HTTP 403 by the access layer.
 */
export class AccessDeniedError extends Error {
  constructor(message: string, readonly permission?: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}
