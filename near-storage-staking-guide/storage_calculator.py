#!/usr/bin/env python3
"""
NEAR Storage Cost Calculator

Calculates storage costs for NEAR Protocol contracts and accounts.
"""

STORAGE_PRICE_PER_BYTE = 10_000_000_000_000_000_000  # yoctoNEAR per byte
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


def format_size(bytes_count: int) -> str:
    """Format bytes to human readable size."""
    if bytes_count < 1024:
        return f"{bytes_count} B"
    if bytes_count < 1024 * 1024:
        return f"{bytes_count / 1024:.2f} KB"
    return f"{bytes_count / (1024 * 1024):.2f} MB"


def print_optimization_tips():
    """Print storage optimization tips."""
    tips = [
        "1. Use shorter key names — keys are stored on-chain",
        "2. Store large data off-chain (IPFS/Arweave), keep only hashes on-chain",
        "3. Use bytes instead of strings for numeric data",
        "4. Batch storage operations to minimize transactions",
        "5. Clean up unused storage with storage_withdraw",
        "6. Use LookupMap instead of UnorderedMap for large datasets",
        "7. Consider using LazyOption for rarely-accessed data",
        "8. Use u128 instead of String for token amounts",
    ]
    print("\n=== Storage Optimization Tips ===")
    for tip in tips:
        print(f"  {tip}")


if __name__ == "__main__":
    print("=== NEAR Storage Cost Calculator ===\n")

    examples = [
        ("Account record", 200),
        ("NFT metadata", 1024),
        ("1000 user records", 102400),
        ("Small contract (10 KB)", 10240),
        ("Medium contract (50 KB)", 51200),
        ("Large contract (200 KB)", 204800),
    ]

    print(f"{'Data Type':30} {'Size':>12} {'Cost':>20}")
    print("-" * 65)
    for name, size in examples:
        result = calculate_storage_cost(size)
        print(f"{name:30} {format_size(size):>12} {result['cost_near_formatted']:>20}")

    print("\n=== Contract Estimation ===")
    contract = estimate_contract_storage(50000, 100000)
    print(f"Code storage:  {contract['code_storage']['cost_near_formatted']}")
    print(f"Data storage:  {contract['data_storage']['cost_near_formatted']}")
    print(f"Total:         {contract['total_cost_formatted']}")

    print_optimization_tips()
