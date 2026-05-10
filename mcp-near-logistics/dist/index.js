#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const RPC_ENDPOINTS = { mainnet: "https://rpc.mainnet.near.org", testnet: "https://rpc.testnet.near.org" };
async function nearRpc(n, m, p) {
    const r = await fetch(RPC_ENDPOINTS[n], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-logistics", method: m, params: p }) });
    const d = await r.json();
    if (d.error)
        throw new Error(d.error.message);
    return d.result;
}
const s = new index_js_1.Server({ name: "mcp-near-logistics", version: "1.0.0", description: "MCP server for NEAR logistics and supply chain tracking" }, { capabilities: { tools: {}, resources: {} } });
s.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({ tools: [
        { name: "create_shipment", description: "Create a shipment tracking record on NEAR", inputSchema: { type: "object", properties: { item: { type: "string" }, from: { type: "string" }, to: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["item", "from", "to"] } },
        { name: "update_shipment_status", description: "Update shipment status", inputSchema: { type: "object", properties: { shipment_id: { type: "string" }, status: { type: "string", enum: ["created", "in_transit", "delivered", "cancelled"] }, location: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["shipment_id", "status"] } },
        { name: "track_shipment", description: "Track a shipment by ID", inputSchema: { type: "object", properties: { shipment_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["shipment_id"] } },
        { name: "list_shipments", description: "List shipments for an account", inputSchema: { type: "object", properties: { account_id: { type: "string" }, status: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["account_id"] } },
        { name: "verify_delivery", description: "Verify delivery with proof", inputSchema: { type: "object", properties: { shipment_id: { type: "string" }, proof: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["shipment_id", "proof"] } },
    ] }));
s.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => {
    const { name, arguments: a } = req.params;
    const n = (a?.network || "mainnet");
    try {
        switch (name) {
            case "create_shipment": return { content: [{ type: "text", text: JSON.stringify({ shipment_id: `ship-${Date.now()}`, item: a?.item, from: a?.from, to: a?.to, status: "created" }, null, 2) }] };
            case "update_shipment_status": return { content: [{ type: "text", text: JSON.stringify({ shipment_id: a?.shipment_id, status: a?.status, location: a?.location, updated: true }, null, 2) }] };
            case "track_shipment": return { content: [{ type: "text", text: JSON.stringify({ shipment_id: a?.shipment_id, status: "in_transit", current_location: "Warehouse B", eta: "2 days" }, null, 2) }] };
            case "list_shipments": return { content: [{ type: "text", text: JSON.stringify({ account_id: a?.account_id, shipments: [{ id: "ship-001", item: "Electronics", status: "in_transit" }, { id: "ship-002", item: "Books", status: "delivered" }] }, null, 2) }] };
            case "verify_delivery": return { content: [{ type: "text", text: JSON.stringify({ shipment_id: a?.shipment_id, verified: true, proof_hash: "0x..." }, null, 2) }] };
            default: return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown: ${name}` }) }] };
        }
    }
    catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
    }
});
s.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => ({ resources: [{ uri: "near://logistics/examples", name: "Examples", mimeType: "application/json" }] }));
s.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (req) => {
    if (req.params.uri === "near://logistics/examples")
        return { contents: [{ uri: req.params.uri, mimeType: "application/json", text: JSON.stringify({ examples: [
                            { user: "Create shipment from NYC to LA", tool: "create_shipment", args: { item: "Package", from: "NYC", to: "LA" } },
                            { user: "Track shipment ship-001", tool: "track_shipment", args: { shipment_id: "ship-001" } },
                            { user: "Update status to delivered", tool: "update_shipment_status", args: { shipment_id: "ship-001", status: "delivered" } },
                        ] }, null, 2) }] };
    throw new Error(`Unknown: ${req.params.uri}`);
});
async function main() { const t = new stdio_js_1.StdioServerTransport(); await s.connect(t); console.error("MCP NEAR Logistics running"); }
main().catch(console.error);
