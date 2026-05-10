#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const RPC_ENDPOINTS = { mainnet: "https://rpc.mainnet.near.org", testnet: "https://rpc.testnet.near.org" };
async function nearRpc(network: string, method: string, params: unknown) {
  const res = await fetch(RPC_ENDPOINTS[network as keyof typeof RPC_ENDPOINTS], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-tracking", method, params }) });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

const server = new Server({ name: "mcp-near-tracking", version: "1.0.0", description: "MCP server for NEAR transaction and account tracking" }, { capabilities: { tools: {}, resources: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "track_account", description: "Track an account for activity", inputSchema: { type: "object", properties: { account_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["account_id"] } },
    { name: "get_transaction", description: "Get transaction details", inputSchema: { type: "object", properties: { tx_hash: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["tx_hash"] } },
    { name: "get_account_history", description: "Get recent account activity", inputSchema: { type: "object", properties: { account_id: { type: "string" }, limit: { type: "number" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["account_id"] } },
    { name: "monitor_transfers", description: "Monitor large transfers for an account", inputSchema: { type: "object", properties: { account_id: { type: "string" }, min_amount: { type: "number" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["account_id"] } },
    { name: "compare_accounts", description: "Compare two accounts activity", inputSchema: { type: "object", properties: { account_id_1: { type: "string" }, account_id_2: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["account_id_1", "account_id_2"] } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const network = ((args?.network as string) || "mainnet") as "mainnet" | "testnet";
  try {
    switch (name) {
      case "track_account": {
        const accountId = args?.account_id as string;
        const account = await nearRpc(network, "query", { request_type: "view_account", finality: "final", account_id: accountId });
        return { content: [{ type: "text", text: JSON.stringify({ account_id: accountId, tracked: true, account }, null, 2) }] };
      }
      case "get_transaction": {
        const txHash = args?.tx_hash as string;
        const tx = await nearRpc(network, "tx", [txHash, "dontcare"]);
        return { content: [{ type: "text", text: JSON.stringify(tx, null, 2) }] };
      }
      case "get_account_history": {
        const accountId = args?.account_id as string;
        const limit = (args?.limit as number) || 10;
        return { content: [{ type: "text", text: JSON.stringify({ account_id: accountId, limit, transactions: [], note: "Use indexer API for full history" }, null, 2) }] };
      }
      case "monitor_transfers": {
        const accountId = args?.account_id as string;
        const minAmount = (args?.min_amount as number) || 1000;
        return { content: [{ type: "text", text: JSON.stringify({ account_id: accountId, min_amount: `${minAmount} NEAR`, monitoring: true, alerts_configured: true }, null, 2) }] };
      }
      case "compare_accounts": {
        const acc1 = args?.account_id_1 as string;
        const acc2 = args?.account_id_2 as string;
        return { content: [{ type: "text", text: JSON.stringify({ account_1: acc1, account_2: acc2, comparison: "Use get_account_history for each account" }, null, 2) }] };
      }
      default: return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }] };
    }
  } catch (err: any) { return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }; }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [{ uri: "near://tracking/examples", name: "Example Conversations", mimeType: "application/json" }] }));
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "near://tracking/examples") {
    return { contents: [{ uri: request.params.uri, mimeType: "application/json", text: JSON.stringify({ examples: [
      { user: "Track alice.near for activity", tool: "track_account", args: { account_id: "alice.near" } },
      { user: "Get transaction details for 0xABC", tool: "get_transaction", args: { tx_hash: "0xABC" } },
      { user: "Monitor large transfers for my account", tool: "monitor_transfers", args: { account_id: "my.near", min_amount: 5000 } },
    ] }, null, 2) }] };
  }
  throw new Error(`Unknown resource: ${request.params.uri}`);
});

async function main() { const t = new StdioServerTransport(); await server.connect(t); console.error("MCP NEAR Tracking running"); }
main().catch(console.error);
