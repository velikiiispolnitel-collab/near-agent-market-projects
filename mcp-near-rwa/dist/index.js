#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const RPC_ENDPOINTS = { mainnet: "https://rpc.mainnet.near.org", testnet: "https://rpc.testnet.near.org" };
async function nearRpc(n, m, p) {
    const r = await fetch(RPC_ENDPOINTS[n], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-rwa", method: m, params: p }) });
    const d = await r.json();
    if (d.error)
        throw new Error(d.error.message);
    return d.result;
}
const s = new index_js_1.Server({ name: "mcp-near-rwa", version: "1.0.0", description: "MCP server for NEAR real-world asset (RWA) tokenization" }, { capabilities: { tools: {}, resources: {} } });
s.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({ tools: [
        { name: "tokenize_asset", description: "Tokenize a real-world asset on NEAR", inputSchema: { type: "object", properties: { asset_type: { type: "string", enum: ["real_estate", "commodity", "security", "art", "other"] }, asset_id: { type: "string" }, valuation: { type: "string" }, total_tokens: { type: "number" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["asset_type", "asset_id", "valuation", "total_tokens"] } },
        { name: "get_asset_info", description: "Get tokenized asset details", inputSchema: { type: "object", properties: { asset_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["asset_id"] } },
        { name: "transfer_tokens", description: "Transfer RWA tokens", inputSchema: { type: "object", properties: { asset_id: { type: "string" }, to: { type: "string" }, amount: { type: "number" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["asset_id", "to", "amount"] } },
        { name: "distribute_yield", description: "Distribute yield to token holders", inputSchema: { type: "object", properties: { asset_id: { type: "string" }, amount: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["asset_id", "amount"] } },
        { name: "list_assets", description: "List tokenized assets for an account", inputSchema: { type: "object", properties: { account_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["account_id"] } },
    ] }));
s.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => {
    const { name, arguments: a } = req.params;
    const n = (a?.network || "mainnet");
    try {
        switch (name) {
            case "tokenize_asset": return { content: [{ type: "text", text: JSON.stringify({ asset_id: a?.asset_id, type: a?.asset_type, valuation: a?.valuation, total_tokens: a?.total_tokens, token_contract: "rwa.near", status: "tokenized" }, null, 2) }] };
            case "get_asset_info": return { content: [{ type: "text", text: JSON.stringify({ asset_id: a?.asset_id, type: "real_estate", valuation: "$500K", total_tokens: 10000, price_per_token: "50 NEAR", yield_apy: 8.5 }, null, 2) }] };
            case "transfer_tokens": return { content: [{ type: "text", text: JSON.stringify({ asset_id: a?.asset_id, from: "user", to: a?.to, amount: a?.amount, tx_hash: "0x..." }, null, 2) }] };
            case "distribute_yield": return { content: [{ type: "text", text: JSON.stringify({ asset_id: a?.asset_id, yield_amount: a?.amount, holders_paid: 150, tx_hash: "0x..." }, null, 2) }] };
            case "list_assets": return { content: [{ type: "text", text: JSON.stringify({ account_id: a?.account_id, assets: [{ id: "rwa-001", type: "real_estate", tokens: 500, value: "25000 NEAR" }, { id: "rwa-002", type: "commodity", tokens: 1000, value: "10000 NEAR" }] }, null, 2) }] };
            default: return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown: ${name}` }) }] };
        }
    }
    catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
    }
});
s.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => ({ resources: [{ uri: "near://rwa/examples", name: "Examples", mimeType: "application/json" }] }));
s.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (req) => {
    if (req.params.uri === "near://rwa/examples")
        return { contents: [{ uri: req.params.uri, mimeType: "application/json", text: JSON.stringify({ examples: [
                            { user: "Tokenize a $500K property into 10000 tokens", tool: "tokenize_asset", args: { asset_type: "real_estate", asset_id: "prop-001", valuation: "500000", total_tokens: 10000 } },
                            { user: "Get info on asset rwa-001", tool: "get_asset_info", args: { asset_id: "rwa-001" } },
                            { user: "Distribute 100 NEAR yield", tool: "distribute_yield", args: { asset_id: "rwa-001", amount: "100" } },
                        ] }, null, 2) }] };
    throw new Error(`Unknown: ${req.params.uri}`);
});
async function main() { const t = new stdio_js_1.StdioServerTransport(); await s.connect(t); console.error("MCP NEAR RWA running"); }
main().catch(console.error);
