/**
 * Money Value Object
 * 
 * Immutable value object representing monetary amounts.
 * Enforces business rules: amounts cannot be negative.
 * 
 * @pattern Value Object
 * @principle Encapsulation, Immutability
 */

export class Money {
  private constructor(private readonly amount: number) {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    if (!Number.isFinite(amount)) {
      throw new Error('Money amount must be a finite number');
    }
  }

  static dollars(amount: number): Money {
    return new Money(amount);
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.amount + other.amount);
  }

  subtract(other: Money): Money {
    return new Money(this.amount - other.amount);
  }

  multiply(factor: number): Money {
    if (factor < 0) {
      throw new Error('Cannot multiply money by negative factor');
    }
    return new Money(this.amount * factor);
  }

  greaterThan(other: Money): boolean {
    return this.amount > other.amount;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.amount >= other.amount;
  }

  lessThan(other: Money): boolean {
    return this.amount < other.amount;
  }

  lessThanOrEqual(other: Money): boolean {
    return this.amount <= other.amount;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount;
  }

  toNumber(): number {
    return this.amount;
  }

  toString(): string {
    return `$${this.amount.toFixed(2)}`;
  }
}
