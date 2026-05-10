"""Tests for NearDeleteAccountTool."""

import json
import pytest
from unittest.mock import AsyncMock, patch

from langchain_near_delete_account.tool import NearDeleteAccountTool, NearDeleteAccountInput


@pytest.fixture
def tool():
    return NearDeleteAccountTool()


class TestNearDeleteAccountTool:

    def test_name_and_description(self, tool):
        assert tool.name == "near_delete_account"
        assert "delete" in tool.description.lower()
        assert "irreversible" in tool.description.lower()
        assert "beneficiary" in tool.description.lower()

    def test_args_schema(self, tool):
        assert tool.args_schema == NearDeleteAccountInput

    def test_validate_account_id_valid(self, tool):
        assert tool._validate_account_id("alice.near") is True
        assert tool._validate_account_id("bob.testnet") is True
        assert tool._validate_account_id("a" * 64) is True

    def test_validate_account_id_invalid(self, tool):
        assert tool._validate_account_id("") is False
        assert tool._validate_account_id("a") is False
        assert tool._validate_account_id(".near") is False
        assert tool._validate_account_id("alice.") is False
        assert tool._validate_account_id("alice..near") is False

    def test_get_rpc_url(self, tool):
        assert "mainnet" in tool._get_rpc_url("mainnet")
        assert "testnet" in tool._get_rpc_url("testnet")

    def test_get_rpc_url_invalid(self, tool):
        with pytest.raises(ValueError, match="Unknown network"):
            tool._get_rpc_url("invalid")

    @pytest.mark.asyncio
    async def test_arun_invalid_account(self, tool):
        result = await tool._arun("INVALID!!!", "bob.near")
        data = json.loads(result)
        assert data["status"] == "validation_failed"
        assert "error" in data

    @pytest.mark.asyncio
    async def test_arun_invalid_beneficiary(self, tool):
        result = await tool._arun("alice.near", "INVALID!!!")
        data = json.loads(result)
        assert data["status"] == "validation_failed"
        assert "error" in data

    @pytest.mark.asyncio
    async def test_arun_same_account_and_beneficiary(self, tool):
        result = await tool._arun("alice.near", "alice.near")
        data = json.loads(result)
        assert data["status"] == "validation_failed"
        assert "cannot be the same" in data["error"]

    @pytest.mark.asyncio
    async def test_arun_rpc_error(self, tool):
        with patch("httpx.AsyncClient.post", side_effect=Exception("Connection refused")):
            result = await tool._arun("alice.near", "bob.near")
            data = json.loads(result)
            assert data["status"] == "rpc_error"
            assert "error" in data

    @pytest.mark.asyncio
    async def test_arun_account_not_found(self, tool):
        mock_resp = AsyncMock()
        mock_resp.json = lambda: {"error": {"message": "Account not found"}}

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await tool._arun("nonexistent.near", "bob.near")
            data = json.loads(result)
            assert data["status"] == "account_not_found"

    @pytest.mark.asyncio
    async def test_arun_success(self, tool):
        account_response = {
            "result": {
                "amount": "10000000000000000000000000",
                "storage_usage": 12345,
            }
        }
        keys_response = {
            "result": {
                "keys": [
                    {"public_key": "ed25519:ABC", "permission": "FullAccess"},
                    {"public_key": "ed25519:DEF", "permission": {"FunctionCall": {"receiver_id": "app.near", "method_names": [], "allowance": "0"}}},
                ]
            }
        }

        mock_resp1 = AsyncMock()
        mock_resp1.json = lambda: account_response
        mock_resp2 = AsyncMock()
        mock_resp2.json = lambda: keys_response

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(side_effect=[mock_resp1, mock_resp2])

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await tool._arun("alice.near", "bob.near")
            data = json.loads(result)
            assert data["status"] == "ready"
            assert data["action"] == "DeleteAccount"
            assert data["account_id"] == "alice.near"
            assert data["beneficiary_id"] == "bob.near"
            assert data["balance_to_transfer"] == "10.0000 NEAR"
            assert data["full_access_keys"] == 1
            assert data["total_keys"] == 2
            assert "warning" in data
            assert "steps" in data
            assert len(data["steps"]) == 4
