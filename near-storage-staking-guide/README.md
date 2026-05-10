# NEAR Storage Staking Guide

## Overview

NEAR Protocol uses a unique **storage staking model** that differs from traditional gas-based blockchains. Instead of paying gas fees for storage, users stake NEAR tokens to store data on-chain. This guide explains how it works, why it matters, and how to optimize your contracts.

## How Storage Staking Works

### The Basics

On NEAR, every byte of data stored in a smart contract requires a corresponding amount of NEAR tokens to be staked (locked). This is called **storage staking**.

```
Storage Cost = Bytes Staked × Storage Price per Byte
```

The current storage price is approximately **10,000,000,000,000,000,000 yoctoNEAR per byte** (0.00001 NEAR per byte).

### Key Concepts

1. **Storage Deposit**: When you store data, you deposit NEAR tokens proportional to the storage used
2. **Refund on Deletion**: When you delete data, the staked NEAR is returned to you
3. **Minimum Balance**: Accounts must maintain a minimum storage balance to exist
4. **Per-Contract Storage**: Each contract tracks its own storage usage

### Account Storage

Every NEAR account has storage costs:

| Account Type | Minimum Storage | Approximate Cost |
|-------------|----------------|-----------------|
| Standard account | ~1.5 KB | ~0.000015 NEAR |
| Contract account | Varies by code + data | Code size + data × price |

### Contract Storage

Smart contracts have two types of storage:

1. **Code Storage**: The compiled WASM code (one-time cost)
2. **Data Storage**: State data that changes during execution

```
Total Storage Cost = Code Size (bytes) × Price + Data Size (bytes) × Price
```

## Calculating Storage Costs

### Simple Calculation

```python
# Storage cost calculator
STORAGE_PRICE_PER_BYTE = 10_000_000_000_000_000_000  # yoctoNEAR
YOCTO_PER_NEAR = 1e24

def calculate_storage_cost(bytes_count):
    cost_yocto = bytes_count * STORAGE_PRICE_PER_BYTE
    cost_near = cost_yocto / YOCTO_PER_NEAR
    return cost_near

# Examples
print(f"1 KB: {calculate_storage_cost(1024):.6f} NEAR")
print(f"1 MB: {calculate_storage_cost(1024 * 1024):.4f} NEAR")
print(f"100 KB contract: {calculate_storage_cost(102400):.4f} NEAR")
```

### Real-World Examples

| Data Type | Size | Cost (NEAR) |
|-----------|------|-------------|
| Account record | ~200 B | 0.000002 |
| NFT metadata | ~1 KB | 0.00001 |
| 1000 user records | ~100 KB | 0.001 |
| Full contract (50 KB) | ~50 KB | 0.0005 |
| Large contract (500 KB) | ~500 KB | 0.005 |

## Storage Optimization Strategies

### 1. Use Efficient Data Structures

```rust
// ❌ Bad: Storing full strings for keys
pub struct BadContract {
    pub user_names: UnorderedMap<String, String>, // Key is expensive
}

// ✅ Good: Use account IDs as keys (fixed size)
pub struct GoodContract {
    pub user_data: UnorderedMap<AccountId, UserData>, // Key is fixed 2-64 bytes
}
```

### 2. Minimize Key Sizes

```rust
// ❌ Bad: Long descriptive keys
storage.set("user_profile_alice_near", &profile);

// ✅ Good: Short keys
storage.set("u:alice", &profile);
```

### 3. Use LookupMap Instead of UnorderedMap

```rust
// ❌ Bad: UnorderedMap stores keys in trie (expensive)
use near_sdk::collections::UnorderedMap;
let mut map = UnorderedMap::new(b"m");

// ✅ Good: LookupMap uses hash-based keys (cheaper)
use near_sdk::collections::LookupMap;
let mut map = LookupMap::new(b"m");
```

### 4. Batch Storage Operations

```rust
// ❌ Bad: Multiple separate writes
for item in items {
    storage.set(&item.id, &item.data); // Each write costs gas + storage
}

// ✅ Good: Batch write
let mut batch = storage.batch();
for item in items {
    batch.set(&item.id, &item.data);
}
batch.commit();
```

### 5. Clean Up Unused Storage

```rust
// Implement storage cleanup
#[payable]
pub fn cleanup_old_data(&mut self, key: String) {
    assert!(env::predecessor_account_id() == self.owner, "Not authorized");
    
    // Remove data and get refund
    if self.data.remove(&key).is_some() {
        // Storage deposit is automatically refunded
        Promise::new(env::predecessor_account_id())
            .transfer(self.calculate_refund(&key));
    }
}
```

## Storage Deposit Patterns

### Pattern 1: User-Pays-for-Storage

```rust
#[payable]
pub fn store_data(&mut self, key: String, value: String) {
    let attached = env::attached_deposit();
    let required = self.calculate_storage_cost(&key, &value);
    
    assert!(attached >= required, "Insufficient storage deposit");
    
    self.data.insert(&key, &value);
    
    // Refund excess
    if attached > required {
        Promise::new(env::predecessor_account_id())
            .transfer(attached - required);
    }
}
```

### Pattern 2: Contract-Pays-for-Storage

```rust
pub fn store_data(&mut self, key: String, value: String) {
    // Contract covers storage cost from its balance
    let cost = self.calculate_storage_cost(&key, &value);
    assert!(env::account_balance() >= cost, "Contract has insufficient balance");
    
    self.data.insert(&key, &value);
}
```

### Pattern 3: Hybrid Approach

```rust
#[payable]
pub fn store_data(&mut self, key: String, value: String) {
    let attached = env::attached_deposit();
    let cost = self.calculate_storage_cost(&key, &value);
    
    // User pays first, contract covers remainder
    let user_contribution = std::cmp::min(attached, cost);
    let contract_contribution = cost - user_contribution;
    
    assert!(env::account_balance() >= contract_contribution, "Contract balance too low");
    
    self.data.insert(&key, &value);
    
    // Refund excess from user
    if attached > user_contribution {
        Promise::new(env::predecessor_account_id())
            .transfer(attached - user_contribution);
    }
}
```

## Common Mistakes to Avoid

### 1. Not Accounting for Key Storage

```rust
// ❌ Mistake: Only counting value size
let cost = value.len() * PRICE_PER_BYTE;

// ✅ Correct: Count both key and value
let cost = (key.len() + value.len()) * PRICE_PER_BYTE;
```

### 2. Storing Large Data On-Chain

```rust
// ❌ Mistake: Storing images on-chain
pub struct BadNFT {
    pub image_data: Vec<u8>, // Could be MBs!
}

// ✅ Correct: Store hash on-chain, data off-chain
pub struct GoodNFT {
    pub image_hash: String, // 32 bytes
    pub image_url: String,  // Points to IPFS/Arweave
}
```

### 3. Not Implementing Storage Cleanup

```rust
// ❌ Mistake: No way to reclaim storage
pub struct BadContract {
    pub data: HashMap<String, String>, // Only grows
}

// ✅ Correct: Implement cleanup with refund
impl GoodContract {
    pub fn remove_data(&mut self, key: String) {
        if let Some(_) = self.data.remove(&key) {
            // Storage deposit automatically refunded
        }
    }
}
```

### 4. Using Strings for Numeric Data

```rust
// ❌ Mistake: Storing numbers as strings
storage.set("balance_alice", "1000000000000000000000000"); // 25 bytes

// ✅ Correct: Store as u128
storage.set("balance_alice", &1000000000000000000000000u128.to_le_bytes()); // 16 bytes
```

## Optimization Checklist

Before deploying a contract, check:

- [ ] **Key sizes**: Are keys as short as possible?
- [ ] **Data types**: Using bytes instead of strings for numeric data?
- [ ] **Data structures**: Using LookupMap instead of UnorderedMap where possible?
- [ ] **Off-chain storage**: Large data stored on IPFS/Arweave with only hashes on-chain?
- [ ] **Cleanup methods**: Implemented storage cleanup functions?
- [ ] **Batch operations**: Using batch writes for multiple operations?
- [ ] **Storage deposits**: Properly handling storage deposit refunds?
- [ ] **Testing**: Tested storage costs with realistic data sizes?

## Storage Cost Calculator Tool

```python
#!/usr/bin/env python3
"""NEAR Storage Cost Calculator"""

STORAGE_PRICE_PER_BYTE = 10_000_000_000_000_000_000  # yoctoNEAR
YOCTO_PER_NEAR = 1e24

def calculate_storage_cost(bytes_count: int) -> dict:
    """Calculate storage cost in NEAR and yoctoNEAR."""
    cost_yocto = bytes_count * STORAGE_PRICE_PER_BYTE
    cost_near = cost_yocto / YOCTO_PER_NEAR
    return {
        "bytes": bytes_count,
        "cost_yocto": str(cost_yocto),
        "cost_near": cost_near,
        "cost_near_formatted": f"{cost_near:.8f} NEAR",
    }

def estimate_contract_storage(code_size: int, data_size: int) -> dict:
    """Estimate total storage cost for a contract."""
    code_cost = calculate_storage_cost(code_size)
    data_cost = calculate_storage_cost(data_size)
    total_bytes = code_size + data_size
    total_near = code_cost["cost_near"] + data_cost["cost_near"]
    
    return {
        "code_storage": code_cost,
        "data_storage": data_cost,
        "total_bytes": total_bytes,
        "total_cost_near": total_near,
        "total_cost_formatted": f"{total_near:.8f} NEAR",
    }

if __name__ == "__main__":
    # Example calculations
    print("=== NEAR Storage Cost Calculator ===\n")
    
    examples = [
        ("Account record", 200),
        ("NFT metadata", 1024),
        ("1000 user records", 102400),
        ("Small contract (10 KB)", 10240),
        ("Medium contract (50 KB)", 51200),
        ("Large contract (200 KB)", 204800),
    ]
    
    for name, size in examples:
        result = calculate_storage_cost(size)
        print(f"{name:30} ({size:>8} B): {result['cost_near_formatted']}")
    
    print("\n=== Contract Estimation ===")
    contract = estimate_contract_storage(50000, 100000)
    print(f"Code: {contract['code_storage']['cost_near_formatted']}")
    print(f"Data: {contract['data_storage']['cost_near_formatted']}")
    print(f"Total: {contract['total_cost_formatted']}")
```

## Summary

NEAR's storage staking model provides predictable storage costs and automatic refunds when data is deleted. Key takeaways:

1. **Storage costs are proportional** to bytes stored
2. **Deposits are refunded** when data is deleted
3. **Optimize key sizes** and use efficient data structures
4. **Store large data off-chain** (IPFS/Arweave) with on-chain hashes
5. **Implement cleanup methods** to reclaim storage deposits
6. **Use LookupMap** over UnorderedMap for cheaper key storage

By following these patterns, you can build cost-effective NEAR applications that minimize storage overhead while maintaining on-chain data integrity.
