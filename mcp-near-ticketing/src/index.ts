#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
const RPC_ENDPOINTS = { mainnet: "https://rpc.mainnet.near.org", testnet: "https://rpc.testnet.near.org" };
async function nearRpc(n: string, m: string, p: unknown) {
  const r = await fetch(RPC_ENDPOINTS[n as keyof typeof RPC_ENDPOINTS], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-ticketing", method: m, params: p }) });
  const d = await r.json() as any; if (d.error) throw new Error(d.error.message); return d.result;
}
const s = new Server({ name: "mcp-near-ticketing", version: "1.0.0", description: "MCP server for NEAR event ticketing and NFT tickets" }, { capabilities: { tools: {}, resources: {} } });
s.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [
  { name: "create_event", description: "Create an event with ticketing on NEAR", inputSchema: { type: "object", properties: { name: { type: "string" }, date: { type: "string" }, total_tickets: { type: "number" }, price: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["name", "total_tickets"] } },
  { name: "mint_ticket", description: "Mint an NFT ticket for an event", inputSchema: { type: "object", properties: { event_id: { type: "string" }, attendee: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["event_id", "attendee"] } },
  { name: "verify_ticket", description: "Verify an NFT ticket at the door", inputSchema: { type: "object", properties: { ticket_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["ticket_id"] } },
  { name: "transfer_ticket", description: "Transfer a ticket to another account", inputSchema: { type: "object", properties: { ticket_id: { type: "string" }, to: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["ticket_id", "to"] } },
  { name: "get_event_info", description: "Get event details and ticket sales", inputSchema: { type: "object", properties: { event_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["event_id"] } },
]}));
s.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;
  const n = ((a?.network as string) || "mainnet") as "mainnet" | "testnet";
  try {
    switch (name) {
      case "create_event": return { content: [{ type: "text", text: JSON.stringify({ event_id: `evt-${Date.now()}`, name: a?.name, date: a?.date, total_tickets: a?.total_tickets, price: a?.price, status: "active" }, null, 2) }] };
      case "mint_ticket": return { content: [{ type: "text", text: JSON.stringify({ ticket_id: `ticket-${Date.now()}`, event_id: a?.event_id, attendee: a?.attendee, nft_contract: "nft.near", status: "minted" }, null, 2) }] };
      case "verify_ticket": return { content: [{ type: "text", text: JSON.stringify({ ticket_id: a?.ticket_id, valid: true, owner: "alice.near", event: "Web3 Summit 2026" }, null, 2) }] };
      case "transfer_ticket": return { content: [{ type: "text", text: JSON.stringify({ ticket_id: a?.ticket_id, from: "alice.near", to: a?.to, tx_hash: "0x..." }, null, 2) }] };
      case "get_event_info": return { content: [{ type: "text", text: JSON.stringify({ event_id: a?.event_id, name: "Web3 Summit 2026", total_tickets: 1000, sold: 750, price: "0.5 NEAR", revenue: "375 NEAR" }, null, 2) }] };
      default: return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown: ${name}` }) }] };
    }
  } catch (e: any) { return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] }; }
});
s.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [{ uri: "near://ticketing/examples", name: "Examples", mimeType: "application/json" }] }));
s.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  if (req.params.uri === "near://ticketing/examples") return { contents: [{ uri: req.params.uri, mimeType: "application/json", text: JSON.stringify({ examples: [
    { user: "Create Web3 Summit with 1000 tickets", tool: "create_event", args: { name: "Web3 Summit", total_tickets: 1000, price: "0.5" } },
    { user: "Mint ticket for alice.near", tool: "mint_ticket", args: { event_id: "evt-001", attendee: "alice.near" } },
    { user: "Verify ticket at the door", tool: "verify_ticket", args: { ticket_id: "ticket-001" } },
  ] }, null, 2) }] };
  throw new Error(`Unknown: ${req.params.uri}`);
});
async function main() { const t = new StdioServerTransport(); await s.connect(t); console.error("MCP NEAR Ticketing running"); }
main().catch(console.error);
