# langchain-near-read-key

LangChain BaseTool to read access keys on NEAR Protocol.

## Installation

```bash
pip install langchain-near-read-key
```

## Usage

```python
from langchain_near_read_key import NearReadKeyTool

tool = NearReadKeyTool()

# Read all keys for an account
result = tool.run({
    "account_id": "alice.near",
    "network": "mainnet"
})
print(result)

# Filter by public key
result = tool.run({
    "account_id": "alice.near",
    "public_key": "ed25519:ABC..."
})
```

## Async Usage

```python
import asyncio
from langchain_near_read_key import NearReadKeyTool

tool = NearReadKeyTool()

async def main():
    result = await tool.arun({
        "account_id": "alice.near",
    })
    print(result)

asyncio.run(main())
```

## API

### NearReadKeyTool

- **name**: `near_read_key`
- **description**: Read access keys for a NEAR account
- **args_schema**: `NearReadKeyInput`
  - `account_id` (str): NEAR account ID
  - `public_key` (str, optional): Filter by public key
  - `network` (str): `mainnet` or `testnet`

### Returns

JSON string with:
- `account_id`: The queried account
- `network`: Network used
- `total_keys`: Number of keys found
- `keys`: Array of access key objects with `public_key`, `permission_type`, and optional `contract_id`, `method_names`, `allowance`
