# langchain-near-delete-account

LangChain BaseTool to delete a NEAR account and transfer remaining balance to a beneficiary.

## Installation

```bash
pip install langchain-near-delete-account
```

## Usage

```python
from langchain_near_delete_account import NearDeleteAccountTool

tool = NearDeleteAccountTool()

result = tool.run({
    "account_id": "alice.near",
    "beneficiary_id": "bob.near",
    "network": "mainnet"
})
print(result)
```

## Warning

This action is **irreversible**. All account data, tokens, and access keys will be permanently lost.

## API

### NearDeleteAccountTool

- **name**: `near_delete_account`
- **args_schema**: `NearDeleteAccountInput`
  - `account_id` (str): Account to delete
  - `beneficiary_id` (str): Account to receive remaining balance
  - `network` (str): `mainnet` or `testnet`

### Returns

JSON with account info, balance to transfer, warnings, and execution steps.
