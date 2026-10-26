import { describe, expect, it } from 'vitest';
import { performativeStyle, protocolLabel } from './performatives';

describe('performatives', () => {
  it('labels every FIPA-ACL performative and ignores unknown ones', () => {
    expect(performativeStyle('REJECT')).toEqual({ color: 'red', label: 'rejects' });
    expect(performativeStyle('PROPOSE')?.label).toBe('proposes');
    expect(performativeStyle('SHOUT')).toBeNull();
    expect(performativeStyle(undefined)).toBeNull();
  });

  it('names the collaboration pattern', () => {
    expect(protocolLabel('pair_develop')).toBe('Pair develop');
    expect(protocolLabel('mob_review')).toBe('mob review');
    expect(protocolLabel()).toBeNull();
  });
});
