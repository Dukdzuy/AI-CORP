/**
 * Runtime settings shared by several modules (Phase 7, Task 32).
 *
 * The JWT secret used to have three different fallbacks (REST, the WebSocket guard and the
 * gateway disagreed), so with no JWT_SECRET set the web app's realtime connection was always
 * rejected. Every reader now goes through jwtSecret(), and production refuses the fallback.
 */

const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret';
export const MIN_PRODUCTION_SECRET_LENGTH = 32;

type Env = Record<string, string | undefined>;

export function isProduction(env: Env = process.env): boolean {
  return env.NODE_ENV === 'production';
}

export function jwtSecret(env: Env = process.env): string {
  return env.JWT_SECRET || DEV_JWT_SECRET;
}

export function looksLikePlaceholder(value: string): boolean {
  return /your_|change_?me|placeholder|<.*>/i.test(value);
}

/** Origins allowed by CORS: CORS_ORIGIN as a comma separated list, everything when unset */
export function corsOrigins(env: Env = process.env): string[] | true {
  const list = (env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return list.length > 0 ? list : true;
}

/** Swagger at /api/docs: on by default, ENABLE_SWAGGER=false turns it off */
export function swaggerEnabled(env: Env = process.env): boolean {
  return (env.ENABLE_SWAGGER ?? 'true').toLowerCase() !== 'false';
}
