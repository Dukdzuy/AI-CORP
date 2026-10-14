/**
 * DomainException - Base class for all domain-level exceptions
 * 
 * Abstracts infrastructure errors (e.g. Prisma) into domain-specific exceptions.
 * Follows Dependency Inversion Principle: domain layer defines error contracts,
 * infrastructure layer throws them.
 * 
 * @pattern Exception Hierarchy
 * @principle Dependency Inversion (DIP)
 */
export abstract class DomainException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
