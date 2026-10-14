import { DomainException } from './DomainException';

/**
 * EntityNotFoundException - Thrown when a domain entity is not found in persistence
 * 
 * Maps to Prisma P2025 error code (record not found).
 */
export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, id: string) {
    super(
      `${entityName} with id '${id}' not found`,
      'ENTITY_NOT_FOUND',
      { entityName, id }
    );
  }
}
