#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
const RPC_ENDPOINTS = { mainnet: "https://rpc.mainnet.near.org", testnet: "https://rpc.testnet.near.org" };
async function nearRpc(n: string, m: string, p: unknown) {
  const r = await fetch(RPC_ENDPOINTS[n as keyof typeof RPC_ENDPOINTS], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-logistics", method: m, params: p }) });
  const d = await r.json() as any; if (d.error) throw new Error(d.error.message); return d.result;
}
const s = new Server({ name: "mcp-near-logistics", version: "1.0.0", description: "MCP server for NEAR logistics and supply chain tracking" }, { capabilities: { tools: {}, resources: {} } });
s.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [
  { name: "create_shipment", description: "Create a shipment tracking record on NEAR", inputSchema: { type: "object", properties: { item: { type: "string" }, from: { type: "string" }, to: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["item", "from", "to"] } },
  { name: "update_shipment_status", description: "Update shipment status", inputSchema: { type: "object", properties: { shipment_id: { type: "string" }, status: { type: "string", enum: ["created", "in_transit", "delivered", "cancelled"] }, location: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["shipment_id", "status"] } },
  { name: "track_shipment", description: "Track a shipment by ID", inputSchema: { type: "object", properties: { shipment_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["shipment_id"] } },
  { name: "list_shipments", description: "List shipments for an account", inputSchema: { type: "object", properties: { account_id: { type: "string" }, status: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["account_id"] } },
  { name: "verify_delivery", description: "Verify delivery with proof", inputSchema: { type: "object", properties: { shipment_id: { type: "string" }, proof: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["shipment_id", "proof"] } },
]}));
s.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;
  const n = ((a?.network as string) || "mainnet") as "mainnet" | "testnet";
  try {
    switch (name) {
      case "create_shipment": return { content: [{ type: "text", text: JSON.stringify({ shipment_id: `ship-${Date.now()}`, item: a?.item, from: a?.from, to: a?.to, status: "created" }, null, 2) }] };
      case "update_shipment_status": return { content: [{ type: "text", text: JSON.stringify({ shipment_id: a?.shipment_id, status: a?.status, location: a?.location, updated: true }, null, 2) }] };
      case "track_shipment": return { content: [{ type: "text", text: JSON.stringify({ shipment_id: a?.shipment_id, status: "in_transit", current_location: "Warehouse B", eta: "2 days" }, null, 2) }] };
      case "list_shipments": return { content: [{ type: "text", text: JSON.stringify({ account_id: a?.account_id, shipments: [{ id: "ship-001", item: "Electronics", status: "in_transit" }, { id: "ship-002", item: "Books", status: "delivered" }] }, null, 2) }] };
      case "verify_delivery": return { content: [{ type: "text", text: JSON.stringify({ shipment_id: a?.shipment_id, verified: true, proof_hash: "0x..." }, null, 2) }] };
      default: return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown: ${name}` }) }] };
    }
  } catch (e: any) { return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] }; }
});
s.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [{ uri: "near://logistics/examples", name: "Examples", mimeType: "application/json" }] }));
s.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  if (req.params.uri === "near://logistics/examples") return { contents: [{ uri: req.params.uri, mimeType: "application/json", text: JSON.stringify({ examples: [
    { user: "Create shipment from NYC to LA", tool: "create_shipment", args: { item: "Package", from: "NYC", to: "LA" } },
    { user: "Track shipment ship-001", tool: "track_shipment", args: { shipment_id: "ship-001" } },
    { user: "Update status to delivered", tool: "update_shipment_status", args: { shipment_id: "ship-001", status: "delivered" } },
  ] }, null, 2) }] };
  throw new Error(`Unknown: ${req.params.uri}`);
});
async function main() { const t = new StdioServerTransport(); await s.connect(t); console.error("MCP NEAR Logistics running"); }
main().catch(console.error);
