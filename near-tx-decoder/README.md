# near-tx-decoder

Decode NEAR transactions into human-readable format. Explains what each transaction does in plain English.

## Installation

```bash
npm install near-tx-decoder
```

## Usage

```typescript
import { decodeTransaction, decodeAction, summarizeTransaction } from 'near-tx-decoder';

// Decode a full transaction
const decoded = decodeTransaction({
  signerId: 'alice.near',
  receiverId: 'bob.near',
  actions: [
    { type: 'Transfer', params: { deposit: '1000000000000000000000000' } },
  ],
});

console.log(decoded.summary);
// "Transfers 1.0000 NEAR to bob.near; Creates a new NEAR account"

// Get human-readable summary
console.log(summarizeTransaction(decoded));
// alice.near → bob.near
//   • Transfers 1.0000 NEAR to bob.near
```

## API

### decodeTransaction(tx)
Decodes a full transaction with multiple actions.

### decodeAction(action)
Decodes a single action. Supports: `CreateAccount`, `DeployContract`, `FunctionCall`, `Transfer`, `Stake`, `AddKey`, `DeleteKey`, `DeleteAccount`.

### summarizeTransaction(tx)
Returns a human-readable multi-line summary.

### formatNearAmount(yoctoNear)
Formats yoctoNEAR to readable string (e.g. "1.0000 NEAR", "1.5K NEAR").

### formatPermission(permission)
Formats access key permission for display.

### lookupMethod(contractId, methodName)
Look up known method description from ABI registry.

### registerABI(contractId, abi)
Register a custom contract ABI for method lookup.

## Supported Action Types

| Type | Description |
|------|-------------|
| CreateAccount | Creates a new NEAR account |
| DeployContract | Deploys a contract |
| FunctionCall | Calls a contract method |
| Transfer | Transfers NEAR tokens |
| Stake | Stakes NEAR |
| AddKey | Adds an access key |
| DeleteKey | Removes an access key |
| DeleteAccount | Deletes an account |
