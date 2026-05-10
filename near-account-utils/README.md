# near-account-utils

Utilities for NEAR account management - validation, formatting, and common operations.

## Installation

```bash
npm install near-account-utils
```

## Usage

```typescript
import {
  isValidAccountId,
  isImplicitAccount,
  formatAccountId,
  batchValidateAccounts,
} from 'near-account-utils';

// Validate account ID
isValidAccountId('alice.near'); // true
isValidAccountId('INVALID'); // false

// Check if implicit account
isImplicitAccount('a'.repeat(64)); // true

// Format for display
formatAccountId('a'.repeat(64)); // "aaaaaaaa...aaaaaaaa"

// Batch operations
batchValidateAccounts(['alice.near', 'bob.testnet']);
// { success: [...], failed: [...] }
```

## API

- `isValidAccountId(id)` - Validate NEAR account ID
- `isImplicitAccount(id)` - Check if 64-char hex implicit account
- `isNamedAccount(id)` - Check if named account
- `formatAccountId(id, maxLength?)` - Truncate for display
- `getTLD(id)` - Get top-level domain
- `getParentAccount(id)` - Get parent account
- `getSubAccountName(id)` - Get sub-account name
- `normalizeAccountId(id)` - Validate and normalize
- `batchValidateAccounts(ids)` - Validate multiple accounts
- `batchFilterByType(ids, type)` - Filter by implicit/named
- `isFullAccessKey(permission)` - Check if full access key
- `isFunctionCallKey(permission)` - Check if function call key
- `formatAccessKeyPermission(permission)` - Human-readable permission
- `accountsEqual(a, b)` - Case-insensitive comparison
- `sortAccounts(ids)` - Alphabetical sort
- `filterByTLD(ids, tld)` - Filter by TLD
- `getAccountDepth(id)` - Get account depth
- `isSubAccount(id)` - Check if sub-account
