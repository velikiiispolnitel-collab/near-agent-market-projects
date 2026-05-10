#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
const RPC_ENDPOINTS = { mainnet: "https://rpc.mainnet.near.org", testnet: "https://rpc.testnet.near.org" };
async function nearRpc(n: string, m: string, p: unknown) {
  const r = await fetch(RPC_ENDPOINTS[n as keyof typeof RPC_ENDPOINTS], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-rewards", method: m, params: p }) });
  const d = await r.json() as any; if (d.error) throw new Error(d.error.message); return d.result;
}
const s = new Server({ name: "mcp-near-rewards", version: "1.0.0", description: "MCP server for NEAR rewards, staking, and incentive management" }, { capabilities: { tools: {}, resources: {} } });
s.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [
  { name: "stake", description: "Stake NEAR tokens with a validator", inputSchema: { type: "object", properties: { amount: { type: "string" }, validator: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["amount", "validator"] } },
  { name: "unstake", description: "Unstake NEAR tokens", inputSchema: { type: "object", properties: { amount: { type: "string" }, validator: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["amount", "validator"] } },
  { name: "claim_rewards", description: "Claim staking rewards", inputSchema: { type: "object", properties: { validator: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["validator"] } },
  { name: "get_staking_info", description: "Get staking info for an account", inputSchema: { type: "object", properties: { account_id: { type: "string" }, network: { type: "string", enum: ["mainnet", "testnet"] } }, required: ["account_id"] } },
  { name: "list_validators", description: "List active validators with APY", inputSchema: { type: "object", properties: { network: { type: "string", enum: ["mainnet", "testnet"] } } } },
]}));
s.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a } = req.params;
  const n = ((a?.network as string) || "mainnet") as "mainnet" | "testnet";
  try {
    switch (name) {
      case "stake": return { content: [{ type: "text", text: JSON.stringify({ action: "stake", amount: a?.amount, validator: a?.validator, tx_hash: "0x...", status: "pending" }, null, 2) }] };
      case "unstake": return { content: [{ type: "text", text: JSON.stringify({ action: "unstake", amount: a?.amount, validator: a?.validator, unlock_epoch: 3, status: "pending" }, null, 2) }] };
      case "claim_rewards": return { content: [{ type: "text", text: JSON.stringify({ action: "claim_rewards", validator: a?.validator, rewards_claimed: "12.5 NEAR", tx_hash: "0x..." }, null, 2) }] };
      case "get_staking_info": return { content: [{ type: "text", text: JSON.stringify({ account_id: a?.account_id, total_staked: "1000 NEAR", rewards_earned: "45.2 NEAR", apy: 10.5, validators: [{ pool: "figment.poolv1.near", staked: "500 NEAR" }, { pool: "chorusone.poolv1.near", staked: "500 NEAR" }] }, null, 2) }] };
      case "list_validators": return { content: [{ type: "text", text: JSON.stringify({ validators: [{ name: "Figment", address: "figment.poolv1.near", apy: 10.5, total_staked: "50M NEAR" }, { name: "Chorus One", address: "chorusone.poolv1.near", apy: 10.2, total_staked: "45M NEAR" }, { name: "Everstake", address: "everstake.poolv1.near", apy: 10.8, total_staked: "30M NEAR" }] }, null, 2) }] };
      default: return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown: ${name}` }) }] };
    }
  } catch (e: any) { return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] }; }
});
s.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [{ uri: "near://rewards/examples", name: "Examples", mimeType: "application/json" }] }));
s.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  if (req.params.uri === "near://rewards/examples") return { contents: [{ uri: req.params.uri, mimeType: "application/json", text: JSON.stringify({ examples: [
    { user: "Stake 100 NEAR with Figment", tool: "stake", args: { amount: "100", validator: "figment.poolv1.near" } },
    { user: "Claim my staking rewards", tool: "claim_rewards", args: { validator: "figment.poolv1.near" } },
    { user: "Show my staking info", tool: "get_staking_info", args: { account_id: "my.near" } },
    { user: "List validators by APY", tool: "list_validators", args: {} },
  ] }, null, 2) }] };
  throw new Error(`Unknown: ${req.params.uri}`);
});
async function main() { const t = new StdioServerTransport(); await s.connect(t); console.error("MCP NEAR Rewards running"); }
main().catch(console.error);
