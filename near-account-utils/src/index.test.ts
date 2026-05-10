import {
  isValidAccountId,
  isImplicitAccount,
  isNamedAccount,
  formatAccountId,
  getTLD,
  getParentAccount,
  getSubAccountName,
  normalizeAccountId,
  batchValidateAccounts,
  batchFilterByType,
  isFullAccessKey,
  isFunctionCallKey,
  formatAccessKeyPermission,
  accountsEqual,
  sortAccounts,
  filterByTLD,
  getAccountDepth,
  isSubAccount,
} from './index';

describe('isValidAccountId', () => {
  test('valid named accounts', () => {
    expect(isValidAccountId('alice.near')).toBe(true);
    expect(isValidAccountId('bob.testnet')).toBe(true);
    expect(isValidAccountId('my-app.near')).toBe(true);
    expect(isValidAccountId('a.b.c.near')).toBe(true);
    expect(isValidAccountId('x123')).toBe(true);
  });

  test('valid implicit accounts', () => {
    expect(isValidAccountId('a'.repeat(64))).toBe(true);
    expect(isValidAccountId('0123456789abcdef'.repeat(4))).toBe(true);
  });

  test('invalid accounts', () => {
    expect(isValidAccountId('')).toBe(false);
    expect(isValidAccountId('a')).toBe(false); // too short
    expect(isValidAccountId('.near')).toBe(false); // starts with dot
    expect(isValidAccountId('alice.')).toBe(false); // ends with dot
    expect(isValidAccountId('alice..near')).toBe(false); // consecutive dots
    expect(isValidAccountId('a'.repeat(65))).toBe(false); // too long
    expect(isValidAccountId('A'.repeat(10))).toBe(false); // uppercase only
  });
});

describe('isImplicitAccount', () => {
  test('detects implicit accounts', () => {
    expect(isImplicitAccount('a'.repeat(64))).toBe(true);
    expect(isImplicitAccount('alice.near')).toBe(false);
  });
});

describe('isNamedAccount', () => {
  test('detects named accounts', () => {
    expect(isNamedAccount('alice.near')).toBe(true);
    expect(isNamedAccount('a'.repeat(64))).toBe(false);
  });
});

describe('formatAccountId', () => {
  test('truncates long accounts', () => {
    expect(formatAccountId('a'.repeat(64), 24)).toContain('...');
  });

  test('keeps short accounts as-is', () => {
    expect(formatAccountId('alice.near', 24)).toBe('alice.near');
  });
});

describe('getTLD', () => {
  test('returns TLD', () => {
    expect(getTLD('alice.near')).toBe('near');
    expect(getTLD('bob.testnet')).toBe('testnet');
    expect(getTLD('a'.repeat(64))).toBeNull();
  });
});

describe('getParentAccount', () => {
  test('returns parent', () => {
    expect(getParentAccount('sub.alice.near')).toBe('alice.near');
    expect(getParentAccount('alice.near')).toBe('near');
    expect(getParentAccount('a'.repeat(64))).toBeNull();
  });
});

describe('getSubAccountName', () => {
  test('returns sub-account name', () => {
    expect(getSubAccountName('sub.alice.near')).toBe('sub');
    expect(getSubAccountName('alice.near')).toBe('alice');
  });
});

describe('normalizeAccountId', () => {
  test('normalizes valid accounts', () => {
    expect(normalizeAccountId('  Alice.NEAR  ')).toBe('alice.near');
  });

  test('throws on invalid accounts', () => {
    expect(() => normalizeAccountId('.invalid.')).toThrow();
  });
});

describe('batchValidateAccounts', () => {
  test('validates batch', () => {
    const result = batchValidateAccounts(['alice.near', '.invalid.', 'bob.testnet']);
    expect(result.success).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
  });
});

describe('batchFilterByType', () => {
  test('filters by type', () => {
    const accounts = ['alice.near', 'a'.repeat(64), 'bob.testnet'];
    const result = batchFilterByType(accounts, 'named');
    expect(result.success).toContain('alice.near');
    expect(result.success).toContain('bob.testnet');
    expect(result.success).not.toContain('a'.repeat(64));
  });
});

describe('access key utilities', () => {
  test('isFullAccessKey', () => {
    expect(isFullAccessKey('FullAccess')).toBe(true);
    expect(isFullAccessKey({ FunctionCall: { allowance: '0', receiverId: 'x', methodNames: [] } })).toBe(false);
  });

  test('isFunctionCallKey', () => {
    expect(isFunctionCallKey({ FunctionCall: { allowance: '0', receiverId: 'x', methodNames: [] } })).toBe(true);
    expect(isFunctionCallKey('FullAccess')).toBe(false);
  });

  test('formatAccessKeyPermission', () => {
    expect(formatAccessKeyPermission('FullAccess')).toBe('Full Access');
    expect(formatAccessKeyPermission({ FunctionCall: { allowance: '0', receiverId: 'contract.near', methodNames: ['method1'] } })).toContain('Function Call');
  });
});

describe('accountsEqual', () => {
  test('compares accounts case-insensitively', () => {
    expect(accountsEqual('Alice.NEAR', 'alice.near')).toBe(true);
    expect(accountsEqual('alice.near', 'bob.near')).toBe(false);
  });
});

describe('sortAccounts', () => {
  test('sorts alphabetically', () => {
    expect(sortAccounts(['charlie', 'alice', 'bob'])).toEqual(['alice', 'bob', 'charlie']);
  });
});

describe('filterByTLD', () => {
  test('filters by TLD', () => {
    expect(filterByTLD(['alice.near', 'bob.testcar', 'charlie.near'], 'near')).toHaveLength(2);
  });
});

describe('getAccountDepth', () => {
  test('returns depth', () => {
    expect(getAccountDepth('alice.near')).toBe(2);
    expect(getAccountDepth('a.b.c.near')).toBe(4);
  });
});

describe('isSubAccount', () => {
  test('detects sub-accounts', () => {
    expect(isSubAccount('sub.alice.near')).toBe(true);
    expect(isSubAccount('alice.near')).toBe(false);
  });
});
