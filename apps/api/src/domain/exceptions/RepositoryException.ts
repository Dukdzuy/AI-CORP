import { DomainException } from './DomainException';

/**
 * RepositoryException - Generic persistence layer error
 * 
 * Thrown when a repository operation fails for reasons not covered by specific exceptions.
 */
export class RepositoryException extends DomainException {
  constructor(operation: string, entityName: string, cause: Error) {
    super(
      `Repository operation '${operation}' failed for ${entityName}`,
      'REPOSITORY_ERROR',
      { operation, entityName, cause: cause.message }
    );
    this.stack = cause.stack;
  }
}
