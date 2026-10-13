/**
 * AgentRole Value Object
 * 
 * Enum-like value object representing agent roles in the system.
 * Based on actual schema: CEO, PM, DEV, QA, MARKETING, BA, ARCHITECT, DEVOPS
 * 
 * @pattern Value Object
 * @principle Type Safety, Domain Vocabulary
 */

export class AgentRole {
  private static readonly VALID_ROLES = [
    'CEO',
    'PM',
    'DEV',
    'QA',
    'MARKETING',
    'BA',
    'ARCHITECT',
    'DEVOPS'
  ] as const;

  private constructor(private readonly value: string) {
    if (!AgentRole.VALID_ROLES.includes(value as any)) {
      throw new Error(`Invalid agent role: ${value}. Must be one of: ${AgentRole.VALID_ROLES.join(', ')}`);
    }
  }

  static fromString(value: string): AgentRole {
    return new AgentRole(value.toUpperCase());
  }

  // Factory methods for each role
  static CEO = new AgentRole('CEO');
  static PM = new AgentRole('PM');
  static DEV = new AgentRole('DEV');
  static QA = new AgentRole('QA');
  static MARKETING = new AgentRole('MARKETING');
  static BA = new AgentRole('BA');
  static ARCHITECT = new AgentRole('ARCHITECT');
  static DEVOPS = new AgentRole('DEVOPS');

  toString(): string {
    return this.value;
  }

  equals(other: AgentRole): boolean {
    return this.value === other.value;
  }

  isTechnical(): boolean {
    return ['DEV', 'QA', 'ARCHITECT', 'DEVOPS'].includes(this.value);
  }

  isManagement(): boolean {
    return ['CEO', 'PM', 'BA'].includes(this.value);
  }
}
