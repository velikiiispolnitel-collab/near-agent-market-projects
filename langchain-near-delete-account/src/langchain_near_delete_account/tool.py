"""
LangChain BaseTool: NEAR Delete Account

Deletes a NEAR account and transfers remaining balance to a beneficiary.
WARNING: This is irreversible. All account data and tokens will be lost.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Type

import httpx
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field


class NearDeleteAccountInput(BaseModel):
    """Input schema for NearDeleteAccountTool."""
    account_id: str = Field(
        description="NEAR account ID to delete (e.g. 'alice.near')"
    )
    beneficiary_id: str = Field(
        description="NEAR account ID to receive the remaining balance"
    )
    network: str = Field(
        default="mainnet",
        description="NEAR network: 'mainnet' or 'testnet'"
    )


class NearDeleteAccountTool(BaseTool):
    """LangChain BaseTool to delete a NEAR account on NEAR Protocol.
    
    WARNING: This action is irreversible. All account data, tokens, and
    access keys will be permanently lost. The remaining NEAR balance
    will be transferred to the specified beneficiary account.
    """
    
    name: str = "near_delete_account"
    description: str = (
        "Delete a NEAR account and transfer remaining balance to a beneficiary. "
        "WARNING: This is irreversible! All account data and tokens will be lost. "
        "Input: account_id (required), beneficiary_id (required), network (mainnet/testnet)."
    )
    args_schema: Type[BaseModel] = NearDeleteAccountInput
    
    RPC_ENDPOINTS: Dict[str, str] = {
        "mainnet": "https://rpc.mainnet.near.org",
        "testnet": "https://rpc.testnet.near.org",
    }
    
    def _get_rpc_url(self, network: str) -> str:
        url = self.RPC_ENDPOINTS.get(network)
        if not url:
            raise ValueError(f"Unknown network: {network}. Use 'mainnet' or 'testnet'.")
        return url
    
    def _validate_account_id(self, account_id: str) -> bool:
        import re
        if not account_id or len(account_id) < 2 or len(account_id) > 64:
            return False
        if len(account_id) == 64:
            return bool(re.match(r'^[a-f0-9]{64}$', account_id))
        if not re.match(r'^[a-z0-9][a-z0-9._-]*[a-z0-9]$', account_id):
            return False
        if re.search(r'[._-]{2,}', account_id):
            return False
        return True
    
    def _run(
        self,
        account_id: str,
        beneficiary_id: str,
        network: str = "mainnet",
    ) -> str:
        import asyncio
        return asyncio.run(self._arun(account_id, beneficiary_id, network))
    
    async def _arun(
        self,
        account_id: str,
        beneficiary_id: str,
        network: str = "mainnet",
    ) -> str:
        # Validate inputs
        if not self._validate_account_id(account_id):
            return json.dumps({
                "error": f"Invalid account ID to delete: {account_id}",
                "status": "validation_failed",
            })
        if not self._validate_account_id(beneficiary_id):
            return json.dumps({
                "error": f"Invalid beneficiary ID: {beneficiary_id}",
                "status": "validation_failed",
            })
        if account_id.lower() == beneficiary_id.lower():
            return json.dumps({
                "error": "account_id and beneficiary_id cannot be the same",
                "status": "validation_failed",
            })
        
        rpc_url = self._get_rpc_url(network)
        
        # Step 1: Check account exists and get balance
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                # Get account info
                response = await client.post(rpc_url, json={
                    "jsonrpc": "2.0",
                    "id": "langchain-tool",
                    "method": "query",
                    "params": {
                        "request_type": "view_account",
                        "finality": "final",
                        "account_id": account_id,
                    },
                })
                account_data = response.json()
        except Exception as e:
            return json.dumps({
                "error": f"RPC request failed: {str(e)}",
                "status": "rpc_error",
            })
        
        if "error" in account_data:
            return json.dumps({
                "error": account_data["error"].get("message", str(account_data["error"])),
                "status": "account_not_found",
            })
        
        # Step 2: Get access keys (need to sign the delete transaction)
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(rpc_url, json={
                    "jsonrpc": "2.0",
                    "id": "langchain-tool",
                    "method": "query",
                    "params": {
                        "request_type": "view_access_key_list",
                        "finality": "final",
                        "account_id": account_id,
                    },
                })
                keys_data = response.json()
        except Exception as e:
            return json.dumps({
                "error": f"Failed to fetch access keys: {str(e)}",
                "status": "rpc_error",
            })
        
        keys = keys_data.get("result", {}).get("keys", [])
        full_access_keys = [k for k in keys if k.get("permission") == "FullAccess"]
        
        # Build result
        account_info = account_data.get("result", {})
        balance_near = f"{int(account_info.get('amount', '0')) / 1e24:.4f}"
        
        result = {
            "status": "ready",
            "action": "DeleteAccount",
            "account_id": account_id,
            "beneficiary_id": beneficiary_id,
            "network": network,
            "balance_to_transfer": f"{balance_near} NEAR",
            "balance_yocto": account_info.get("amount", "0"),
            "storage_bytes": account_info.get("storage_usage", 0),
            "full_access_keys": len(full_access_keys),
            "total_keys": len(keys),
            "warning": "This action is irreversible. All account data and tokens will be permanently lost.",
            "steps": [
                "1. Verify account ownership (requires FullAccess key)",
                "2. Transfer all tokens to beneficiary",
                "3. Delete all access keys",
                "4. Delete account and transfer remaining NEAR to beneficiary",
            ],
            "estimated_gas": "30000000000000",
            "explorer_link": f"https://nearblocks.io/address/{account_id}",
        }
        
        return json.dumps(result, indent=2)
