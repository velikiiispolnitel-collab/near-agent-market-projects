"""Tests for NearReadKeyTool."""

import json
import pytest
from unittest.mock import AsyncMock, patch

from langchain_near_read_key.tool import NearReadKeyTool, NearReadKeyInput


@pytest.fixture
def tool():
    return NearReadKeyTool()


class TestNearReadKeyTool:

    def test_name_and_description(self, tool):
        assert tool.name == "near_read_key"
        assert "NEAR" in tool.description
        assert "access key" in tool.description.lower()

    def test_args_schema(self, tool):
        assert tool.args_schema == NearReadKeyInput

    def test_validate_account_id_valid(self, tool):
        assert tool._validate_account_id("alice.near") is True
        assert tool._validate_account_id("bob.testnet") is True
        assert tool._validate_account_id("a" * 64) is True
        assert tool._validate_account_id("my-app.near") is True

    def test_validate_account_id_invalid(self, tool):
        assert tool._validate_account_id("") is False
        assert tool._validate_account_id("a") is False
        assert tool._validate_account_id(".near") is False
        assert tool._validate_account_id("alice.") is False
        assert tool._validate_account_id("alice..near") is False
        assert tool._validate_account_id("A" * 10) is False  # uppercase

    def test_parse_permission_full_access(self, tool):
        result = tool._parse_permission("FullAccess")
        assert result.permission_type == "FullAccess"

    def test_parse_permission_function_call(self, tool):
        permission = {
            "FunctionCall": {
                "receiver_id": "app.near",
                "method_names": ["transfer", "approve"],
                "allowance": "1000000000000000000000000",
            }
        }
        result = tool._parse_permission(permission)
        assert result.permission_type == "FunctionCall"
        assert result.contract_id == "app.near"
        assert result.method_names == ["transfer", "approve"]

    def test_parse_permission_unknown(self, tool):
        result = tool._parse_permission({})
        assert result.permission_type == "Unknown"

    def test_get_rpc_url_mainnet(self, tool):
        assert "mainnet" in tool._get_rpc_url("mainnet")

    def test_get_rpc_url_testnet(self, tool):
        assert "testnet" in tool._get_rpc_url("testnet")

    def test_get_rpc_url_invalid(self, tool):
        with pytest.raises(ValueError, match="Unknown network"):
            tool._get_rpc_url("invalid")

    @pytest.mark.asyncio
    async def test_arun_invalid_account(self, tool):
        result = await tool._arun("INVALID!!!")
        data = json.loads(result)
        assert "error" in data

    @pytest.mark.asyncio
    async def test_arun_rpc_error(self, tool):
        with patch("httpx.AsyncClient.post", side_effect=Exception("Connection refused")):
            result = await tool._arun("alice.near")
            data = json.loads(result)
            assert "error" in data
            assert "RPC request failed" in data["error"]

    @pytest.mark.asyncio
    async def test_arun_success(self, tool):
        mock_response = {
            "result": {
                "keys": [
                    {
                        "public_key": "ed25519:ABC123",
                        "permission": "FullAccess",
                    },
                    {
                        "public_key": "ed25519:DEF456",
                        "permission": {
                            "FunctionCall": {
                                "receiver_id": "app.near",
                                "method_names": ["transfer"],
                                "allowance": "1000000000000000000000000",
                            }
                        },
                    },
                ]
            }
        }

        mock_resp = AsyncMock()
        mock_resp.json = lambda: mock_response
        mock_resp.status_code = 200

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await tool._arun("alice.near")
            data = json.loads(result)
            assert data["account_id"] == "alice.near"
            assert data["total_keys"] == 2
            assert data["keys"][0]["permission_type"] == "FullAccess"
            assert data["keys"][1]["permission_type"] == "FunctionCall"
    
    @pytest.mark.asyncio
    async def test_arun_filter_by_public_key(self, tool):
        mock_response = {
            "result": {
                "keys": [
                    {"public_key": "ed25519:ABC123", "permission": "FullAccess"},
                    {"public_key": "ed25519:DEF456", "permission": "FullAccess"},
                ]
            }
        }

        mock_resp = AsyncMock()
        mock_resp.json = lambda: mock_response
        mock_resp.status_code = 200

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = await tool._arun("alice.near", public_key="ABC123")
            data = json.loads(result)
            assert data["total_keys"] == 1
            assert "ABC123" in data["keys"][0]["public_key"]
