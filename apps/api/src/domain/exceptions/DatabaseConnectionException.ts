import { DomainException } from './DomainException';

/**
 * DatabaseConnectionException - Thrown when database connection fails
 * 
 * Maps to Prisma P2021, P2024 error codes (connection errors).
 */
export class DatabaseConnectionException extends DomainException {
  constructor(cause: Error) {
    super(
      'Database connection failed',
      'DATABASE_CONNECTION_ERROR',
      { cause: cause.message }
    );
    this.stack = cause.stack;
  }
}
