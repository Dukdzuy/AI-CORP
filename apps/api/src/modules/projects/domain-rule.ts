import { BadRequestException } from '@nestjs/common';

/**
 * Run entity business logic and translate a broken domain rule into an HTTP 400.
 * Entities stay framework-free (they throw plain Errors); the application layer
 * decides how a rule violation is reported to the caller.
 */
export function applyDomainRule<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    throw new BadRequestException((error as Error).message);
  }
}
