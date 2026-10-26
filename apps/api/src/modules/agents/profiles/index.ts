import { RoleProfile } from './role-profile';
import { CEO_PROFILE } from './ceo.profile';
import { PM_PROFILE } from './pm.profile';
import { BA_PROFILE } from './ba.profile';
import { ARCHITECT_PROFILE } from './architect.profile';
import { DEV_PROFILE } from './dev.profile';
import { QC_PROFILE } from './qc.profile';
import { QA_PROFILE } from './qa.profile';
import { MARKETING_PROFILE } from './marketing.profile';

export * from './role-profile';
export { CEO_PROFILE, PM_PROFILE, BA_PROFILE, ARCHITECT_PROFILE, DEV_PROFILE, QC_PROFILE, QA_PROFILE, MARKETING_PROFILE };

/** Every role in the roster, in workflow order. The seed creates one Agent row per entry. */
export const ROLE_PROFILES: readonly RoleProfile[] = Object.freeze([
  CEO_PROFILE,
  BA_PROFILE,
  ARCHITECT_PROFILE,
  PM_PROFILE,
  DEV_PROFILE,
  QC_PROFILE,
  QA_PROFILE,
  MARKETING_PROFILE,
]);
