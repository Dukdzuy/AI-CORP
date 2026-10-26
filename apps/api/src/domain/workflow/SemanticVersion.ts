/**
 * SemanticVersion Value Object (Task 17)
 *
 * MAJOR.MINOR.PATCH with optional build metadata ("1.0.0+3f2a9c"). Build metadata is used for
 * definitions instantiated from a template: same template version, different parameters.
 * Build metadata does not take part in ordering (SemVer 2.0 §10).
 *
 * @pattern Value Object
 */
export class SemanticVersion {
  private static readonly PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:\+([0-9A-Za-z.-]+))?$/;

  private constructor(
    readonly major: number,
    readonly minor: number,
    readonly patch: number,
    readonly build?: string
  ) {}

  static parse(value: string): SemanticVersion {
    const match = SemanticVersion.PATTERN.exec((value || '').trim());
    if (!match) {
      throw new Error(`Invalid workflow version '${value}': expected MAJOR.MINOR.PATCH[+build]`);
    }
    return new SemanticVersion(Number(match[1]), Number(match[2]), Number(match[3]), match[4]);
  }

  static isValid(value: string): boolean {
    return SemanticVersion.PATTERN.test((value || '').trim());
  }

  withBuild(build: string): SemanticVersion {
    return new SemanticVersion(this.major, this.minor, this.patch, build);
  }

  /** Negative when this < other, 0 when equal precedence, positive when this > other */
  compareTo(other: SemanticVersion): number {
    return this.major - other.major || this.minor - other.minor || this.patch - other.patch;
  }

  equals(other: SemanticVersion): boolean {
    return this.toString() === other.toString();
  }

  toString(): string {
    const core = `${this.major}.${this.minor}.${this.patch}`;
    return this.build ? `${core}+${this.build}` : core;
  }
}
