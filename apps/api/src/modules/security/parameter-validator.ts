/**
 * ParameterValidator
 *
 * Validates tool parameters against their JSON Schema definitions
 * before execution to prevent errors and security issues.
 *
 * Implements Requirement 25.2: Parameter Validation for Tool Execution
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate parameters against a JSON Schema.
 *
 * @param params - Parameters object to validate
 * @param schema - JSON Schema definition
 * @param toolName - Tool name for error messages
 * @returns ValidationResult with validity and any errors
 */
export function validateParameters(
  params: Record<string, unknown>,
  schema: Record<string, unknown>,
  toolName: string
): ValidationResult {
  const errors: string[] = [];

  if (!params || typeof params !== 'object') {
    return { valid: false, errors: [`${toolName}: parameters must be an object`] };
  }

  const required = (schema.required as string[]) || [];
  const properties = (schema.properties as Record<string, Record<string, unknown>>) || {};

  // Check required fields
  for (const field of required) {
    if (params[field] === undefined || params[field] === null) {
      errors.push(`${toolName}: missing required parameter '${field}'`);
    }
  }

  // Validate each parameter against its schema
  for (const [key, value] of Object.entries(params)) {
    const propSchema = properties[key];
    if (!propSchema) {
      // Allow extra parameters (not strict mode)
      continue;
    }

    const paramType = propSchema.type as string | undefined;
    const paramMaxLen = propSchema.maxLength as number | undefined;
    const paramMin = propSchema.minimum as number | undefined;
    const paramMax = propSchema.maximum as number | undefined;
    const paramEnum = propSchema.enum as unknown[] | undefined;

    // Type check
    if (paramType) {
      if (!checkType(value, paramType)) {
        errors.push(`${toolName}: parameter '${key}' must be ${paramType}, got ${typeof value}`);
        continue;
      }
    }

    // String length check
    if (paramType === 'string' && typeof value === 'string') {
      if (paramMaxLen && value.length > paramMaxLen) {
        errors.push(`${toolName}: parameter '${key}' exceeds max length ${paramMaxLen}`);
      }
    }

    // Number range check
    if (paramType === 'number' && typeof value === 'number') {
      if (paramMin !== undefined && value < paramMin) {
        errors.push(`${toolName}: parameter '${key}' must be >= ${paramMin}`);
      }
      if (paramMax !== undefined && value > paramMax) {
        errors.push(`${toolName}: parameter '${key}' must be <= ${paramMax}`);
      }
    }

    // Enum check
    if (paramEnum && !paramEnum.includes(value)) {
      errors.push(`${toolName}: parameter '${key}' must be one of [${paramEnum.join(', ')}]`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function checkType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}
