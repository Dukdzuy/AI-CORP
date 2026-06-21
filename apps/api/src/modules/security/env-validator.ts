import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NINE_ROUTER_API_KEY',
];

const OPTIONAL_ENV_VARS = [
  'NINE_ROUTER_URL',
  'ANTHROPIC_API_KEY',
  'REDIS_URL',
  'PORT',
];

@Injectable()
export class EnvValidator implements OnModuleInit {
  private readonly logger = new Logger(EnvValidator.name);

  onModuleInit() {
    this.validate();
  }

  validate(): EnvValidationResult {
    const missing: string[] = [];
    const present: string[] = [];

    for (const key of REQUIRED_ENV_VARS) {
      if (!process.env[key]) {
        missing.push(key);
      } else {
        present.push(key);
      }
    }

    for (const key of OPTIONAL_ENV_VARS) {
      if (process.env[key]) {
        present.push(key);
      }
    }

    if (missing.length > 0) {
      this.logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    } else {
      this.logger.log(`Environment validated: ${present.length} variables loaded`);
    }

    // Check for placeholder secrets
    const placeholderKeys = [...REQUIRED_ENV_VARS, ...OPTIONAL_ENV_VARS].filter(key => {
      const v = process.env[key];
      return v && (v.includes('your_') || v.includes('CHANGE_ME') || v.includes('placeholder'));
    });
    if (placeholderKeys.length > 0) {
      this.logger.warn(`PLACEHOLDER SECRETS DETECTED: ${placeholderKeys.join(', ')} - change before production!`);
    }

    return { valid: missing.length === 0, missing, present };
  }
}

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  present: string[];
}
