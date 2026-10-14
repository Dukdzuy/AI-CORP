import { DomainException } from './DomainException';

/**
 * ForeignKeyViolationException - Thrown on referential integrity violation
 * 
 * Maps to Prisma P2003 error code (foreign key constraint failed).
 * Typically occurs when attempting to delete a record that is referenced by other entities.
 */
export class ForeignKeyViolationException extends DomainException {
  constructor(entityName: string, referencedEntity: string) {
    super(
      `Cannot delete ${entityName}: referenced by ${referencedEntity}`,
      'FOREIGN_KEY_VIOLATION',
      { entityName, referencedEntity }
    );
  }
}
