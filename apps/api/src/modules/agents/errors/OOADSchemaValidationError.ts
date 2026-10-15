export class OOADSchemaValidationError extends Error {
  constructor(public schemaName: string, public errors: any[]) {
    super(`OOAD schema validation failed for ${schemaName}: ${JSON.stringify(errors)}`);
    this.name = 'OOADSchemaValidationError';
  }
}
