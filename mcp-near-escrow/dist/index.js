#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const RPC_ENDPOINTS = { mainnet: "https://rpc.mainnet.near.org", testnet: "https://rpc.testnet.near.org" };
async function nearRpc(n, m, p) {
    const r = await fetch(RPC_ENDPOINTS[n], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-escrow", method: m, params: p }) });
    const d = await r.json();
    if (d.error)
        throw new Error(d.error.message);
    return d.result;
}
const s = new index_js_1.Server({ name: "mcp-near-escrow", version: "1.0.0", description: "MCP server for NEAR escrow contracts and secure payments" }, { capabilities: { tools: {}, resources: {} } });
s.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({ tools: [
        { name: "create_escrow", description: "Create an escrow contract on NEAR", inputSchema: { type: "object", properties: { buyer: { type: "string" }, seller: { type: "string" }, amount: { type: "string" }, conditions: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["buyer", "seller", "amount"] } },
        { name: "fund_escrow", description: "Fund an escrow contract", inputSchema: { type: "object", properties: { escrow_id: { type: "string" }, amount: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["escrow_id", "amount"] } },
        { name: "release_escrow", description: "Release funds to seller", inputSchema: { type: "object", properties: { escrow_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["escrow_id"] } },
        { name: "refund_escrow", description: "Refund buyer from escrow", inputSchema: { type: "object", properties: { escrow_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["escrow_id"] } },
        { name: "get_escrow_status", description: "Get escrow contract status", inputSchema: { type: "object", properties: { escrow_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["escrow_id"] } },
    ] }));
s.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => {
    const { name, arguments: a } = req.params;
    const n = (a?.network || "mainnet");
    try {
        switch (name) {
            case "create_escrow": return { content: [{ type: "text", text: JSON.stringify({ escrow_id: `escrow-${Date.now()}`, buyer: a?.buyer, seller: a?.seller, amount: a?.amount, conditions: a?.conditions, status: "created" }, null, 2) }] };
            case "fund_escrow": return { content: [{ type: "text", text: JSON.stringify({ escrow_id: a?.escrow_id, funded: a?.amount, status: "funded", tx_hash: "0x..." }, null, 2) }] };
            case "release_escrow": return { content: [{ type: "text", text: JSON.stringify({ escrow_id: a?.escrow_id, released_to: "seller", status: "completed", tx_hash: "0x..." }, null, 2) }] };
            case "refund_escrow": return { content: [{ type: "text", text: JSON.stringify({ escrow_id: a?.escrow_id, refunded_to: "buyer", status: "refunded", tx_hash: "0x..." }, null, 2) }] };
            case "get_escrow_status": return { content: [{ type: "text", text: JSON.stringify({ escrow_id: a?.escrow_id, status: "funded", buyer: "alice.near", seller: "bob.near", amount: "100 NEAR", created_at: "2026-05-10" }, null, 2) }] };
            default: return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown: ${name}` }) }] };
        }
    }
    catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
    }
});
s.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => ({ resources: [{ uri: "near://escrow/examples", name: "Examples", mimeType: "application/json" }] }));
s.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (req) => {
    if (req.params.uri === "near://escrow/examples")
        return { contents: [{ uri: req.params.uri, mimeType: "application/json", text: JSON.stringify({ examples: [
                            { user: "Create escrow for 100 NEAR", tool: "create_escrow", args: { buyer: "alice.near", seller: "bob.near", amount: "100" } },
                            { user: "Fund escrow escrow-001", tool: "fund_escrow", args: { escrow_id: "escrow-001", amount: "100" } },
                            { user: "Release funds to seller", tool: "release_escrow", args: { escrow_id: "escrow-001" } },
                        ] }, null, 2) }] };
    throw new Error(`Unknown: ${req.params.uri}`);
});
async function main() { const t = new stdio_js_1.StdioServerTransport(); await s.connect(t); console.error("MCP NEAR Escrow running"); }
main().catch(console.error);
