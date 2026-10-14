import { DomainException } from './DomainException';

/**
 * UniqueConstraintViolationException - Thrown when unique constraint is violated
 * 
 * Maps to Prisma P2002 error code (unique constraint failed).
 * Typically occurs when attempting to create duplicate records.
 */
export class UniqueConstraintViolationException extends DomainException {
  constructor(entityName: string, field: string) {
    super(
      `${entityName} already exists with this ${field}`,
      'UNIQUE_CONSTRAINT_VIOLATION',
      { entityName, field }
    );
  }
}
