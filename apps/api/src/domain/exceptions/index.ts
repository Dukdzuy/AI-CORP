/**
 * Domain Exceptions - Exception hierarchy for domain layer
 * 
 * Abstracts infrastructure errors into domain-specific exceptions.
 * Follows DIP: domain defines exception contracts, infrastructure throws them.
 */

export { DomainException } from './DomainException';
export { EntityNotFoundException } from './EntityNotFoundException';
export { RepositoryException } from './RepositoryException';
export { ForeignKeyViolationException } from './ForeignKeyViolationException';
export { DatabaseConnectionException } from './DatabaseConnectionException';
export { UniqueConstraintViolationException } from './UniqueConstraintViolationException';
