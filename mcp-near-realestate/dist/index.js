#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const RPC_ENDPOINTS = { mainnet: "https://rpc.mainnet.near.org", testnet: "https://rpc.testnet.near.org" };
async function nearRpc(n, m, p) {
    const r = await fetch(RPC_ENDPOINTS[n], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-re", method: m, params: p }) });
    const d = await r.json();
    if (d.error)
        throw new Error(d.error.message);
    return d.result;
}
const s = new index_js_1.Server({ name: "mcp-near-real-estate", version: "1.0.0", description: "MCP server for NEAR real estate tokenization and property management" }, { capabilities: { tools: {}, resources: {} } });
s.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({ tools: [
        { name: "list_property", description: "List a property as an NFT on NEAR", inputSchema: { type: "object", properties: { property_id: { type: "string" }, price: { type: "string" }, metadata: { type: "object" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["property_id", "price"] } },
        { name: "get_property", description: "Get property details", inputSchema: { type: "object", properties: { property_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["property_id"] } },
        { name: "transfer_property", description: "Transfer property ownership", inputSchema: { type: "object", properties: { property_id: { type: "string" }, to: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["property_id", "to"] } },
        { name: "fractionalize", description: "Fractionalize a property into tokens", inputSchema: { type: "object", properties: { property_id: { type: "string" }, total_shares: { type: "number" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["property_id", "total_shares"] } },
        { name: "list_properties", description: "List properties for an account", inputSchema: { type: "object", properties: { account_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["account_id"] } },
    ] }));
s.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => {
    const { name, arguments: a } = req.params;
    const n = (a?.network || "mainnet");
    try {
        switch (name) {
            case "list_property": return { content: [{ type: "text", text: JSON.stringify({ property_id: a?.property_id, price: a?.price, status: "listed", nft_contract: "nft.near" }, null, 2) }] };
            case "get_property": return { content: [{ type: "text", text: JSON.stringify({ property_id: a?.property_id, owner: "alice.near", price: "500000 NEAR", status: "listed" }, null, 2) }] };
            case "transfer_property": return { content: [{ type: "text", text: JSON.stringify({ property_id: a?.property_id, from: "alice.near", to: a?.to, tx_hash: "0x..." }, null, 2) }] };
            case "fractionalize": return { content: [{ type: "text", text: JSON.stringify({ property_id: a?.property_id, total_shares: a?.total_shares, token_contract: "tokens.near" }, null, 2) }] };
            case "list_properties": return { content: [{ type: "text", text: JSON.stringify({ account_id: a?.account_id, properties: [{ id: "prop-001", price: "500K NEAR" }, { id: "prop-002", price: "750K NEAR" }] }, null, 2) }] };
            default: return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown: ${name}` }) }] };
        }
    }
    catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
    }
});
s.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => ({ resources: [{ uri: "near://realestate/examples", name: "Examples", mimeType: "application/json" }] }));
s.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (req) => {
    if (req.params.uri === "near://realestate/examples")
        return { contents: [{ uri: req.params.uri, mimeType: "application/json", text: JSON.stringify({ examples: [
                            { user: "List my property for 500K NEAR", tool: "list_property", args: { property_id: "prop-001", price: "500000" } },
                            { user: "Transfer prop-001 to bob.near", tool: "transfer_property", args: { property_id: "prop-001", to: "bob.near" } },
                            { user: "Fractionalize into 1000 shares", tool: "fractionalize", args: { property_id: "prop-001", total_shares: 1000 } },
                        ] }, null, 2) }] };
    throw new Error(`Unknown: ${req.params.uri}`);
});
async function main() { const t = new stdio_js_1.StdioServerTransport(); await s.connect(t); console.error("MCP NEAR Real Estate running"); }
main().catch(console.error);
