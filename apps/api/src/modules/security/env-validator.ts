import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { isProduction, looksLikePlaceholder, MIN_PRODUCTION_SECRET_LENGTH } from './runtime-config';

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NINE_ROUTER_API_KEY',
];

/** Production also needs its own JWT secret and the origin the web app is served from */
const REQUIRED_IN_PRODUCTION = ['JWT_SECRET', 'CORS_ORIGIN'];

const OPTIONAL_ENV_VARS = [
  'NINE_ROUTER_URL',
  'ANTHROPIC_API_KEY',
  'LLM_SECRET_KEY',
  'REDIS_HOST',
  'PORT',
];

/**
 * Checks the environment at boot. In development it only logs; with NODE_ENV=production a
 * missing variable, a placeholder secret or a short JWT secret stops the API from starting
 * (Phase 7, Task 32), because each of them would otherwise fail later and silently.
 */
@Injectable()
export class EnvValidator implements OnModuleInit {
  private readonly logger = new Logger(EnvValidator.name);

  onModuleInit() {
    const result = this.validate();
    if (isProduction() && result.errors.length > 0) {
      throw new Error(`Invalid production environment: ${result.errors.join('; ')}`);
    }
  }

  validate(env: Record<string, string | undefined> = process.env): EnvValidationResult {
    const production = isProduction(env);
    const required = production ? [...REQUIRED_ENV_VARS, ...REQUIRED_IN_PRODUCTION] : REQUIRED_ENV_VARS;
    const missing = required.filter((key) => !env[key]);
    const present = [...required, ...OPTIONAL_ENV_VARS].filter((key) => env[key]);
    const errors: string[] = [];

    if (missing.length > 0) {
      this.logger.error(`Missing required environment variables: ${missing.join(', ')}`);
      errors.push(`missing ${missing.join(', ')}`);
    } else {
      this.logger.log(`Environment validated: ${present.length} variables loaded`);
    }

    const placeholderKeys = [...required, ...OPTIONAL_ENV_VARS].filter((key) => {
      const value = env[key];
      return value && looksLikePlaceholder(value);
    });
    if (placeholderKeys.length > 0) {
      this.logger.warn(`PLACEHOLDER SECRETS DETECTED: ${placeholderKeys.join(', ')} - change before production!`);
      if (production) errors.push(`placeholder values in ${placeholderKeys.join(', ')}`);
    }

    const secret = env.JWT_SECRET;
    if (production && secret && secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      errors.push(`JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters`);
    }

    return { valid: errors.length === 0, missing, present, errors };
  }
}

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  present: string[];
  errors: string[];
}
