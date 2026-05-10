"""
LangChain BaseTool: NEAR Read Key

Reads access keys for a NEAR account via RPC.
Supports filtering by public key and permission type.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Type

import httpx
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field


class NearReadKeyInput(BaseModel):
    """Input schema for NearReadKeyTool."""
    account_id: str = Field(
        description="NEAR account ID (e.g. 'alice.near' or 64-char hex implicit account)"
    )
    public_key: Optional[str] = Field(
        default=None,
        description="Optional: filter by specific public key (e.g. 'ed25519:ABC...')"
    )
    network: str = Field(
        default="mainnet",
        description="NEAR network: 'mainnet' or 'testnet'"
    )


class AccessKeyInfo(BaseModel):
    """Represents a single access key."""
    public_key: str
    permission_type: str
    contract_id: Optional[str] = None
    method_names: Optional[List[str]] = None
    allowance: Optional[str] = None


class NearReadKeyTool(BaseTool):
    """LangChain BaseTool to read access keys on NEAR Protocol.
    
    Retrieves all access keys for a given NEAR account, including
    their permissions (FullAccess or FunctionCall with contract/method details).
    """
    
    name: str = "near_read_key"
    description: str = (
        "Read access keys for a NEAR account. "
        "Returns all access keys with their permissions. "
        "Input: account_id (required), public_key (optional filter), network (mainnet/testnet)."
    )
    args_schema: Type[BaseModel] = NearReadKeyInput
    
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
    
    def _parse_permission(self, permission: Any) -> AccessKeyInfo:
        if permission == "FullAccess":
            return AccessKeyInfo(public_key="", permission_type="FullAccess")
        if isinstance(permission, dict) and "FunctionCall" in permission:
            fc = permission["FunctionCall"]
            return AccessKeyInfo(
                public_key="",
                permission_type="FunctionCall",
                contract_id=fc.get("receiver_id"),
                method_names=fc.get("method_names", []),
                allowance=fc.get("allowance"),
            )
        return AccessKeyInfo(public_key="", permission_type="Unknown")
    
    def _run(self, account_id: str, public_key: Optional[str] = None, network: str = "mainnet") -> str:
        import asyncio
        return asyncio.run(self._arun(account_id, public_key, network))
    
    async def _arun(self, account_id: str, public_key: Optional[str] = None, network: str = "mainnet") -> str:
        if not self._validate_account_id(account_id):
            return json.dumps({"error": f"Invalid NEAR account ID: {account_id}", "account_id": account_id})
        
        rpc_url = self._get_rpc_url(network)
        payload = {
            "jsonrpc": "2.0",
            "id": "langchain-tool",
            "method": "query",
            "params": {
                "request_type": "view_access_key_list",
                "finality": "final",
                "account_id": account_id,
            },
        }
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(rpc_url, json=payload)
                data = response.json()
        except Exception as e:
            return json.dumps({"error": f"RPC request failed: {str(e)}", "account_id": account_id, "network": network})
        
        if "error" in data:
            return json.dumps({"error": data["error"].get("message", str(data["error"])), "account_id": account_id})
        
        result = data.get("result", {})
        keys = result.get("keys", [])
        access_keys: List[Dict[str, Any]] = []
        
        for key in keys:
            pk = key.get("public_key", "")
            permission = key.get("permission", "Unknown")
            if public_key and public_key not in pk:
                continue
            parsed = self._parse_permission(permission)
            entry = {"public_key": pk, "permission_type": parsed.permission_type}
            if parsed.permission_type == "FunctionCall":
                entry["contract_id"] = parsed.contract_id
                entry["method_names"] = parsed.method_names
                entry["allowance"] = parsed.allowance
            access_keys.append(entry)
        
        return json.dumps({
            "account_id": account_id,
            "network": network,
            "total_keys": len(access_keys),
            "keys": access_keys,
        }, indent=2)
