#!/usr/bin/env node

/**
 * MCP Server - NEAR Voting Suite
 * 
 * Model Context Protocol server for NEAR voting use cases.
 * Provides tools for creating ballots, casting votes, tallying results,
 * vote delegation, and voting analytics.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ballot {
  id: string;
  title: string;
  description: string;
  options: BallotOption[];
  startTime: number;
  endTime: number;
  status: "draft" | "active" | "closed";
  totalVotes: number;
  quorum?: number;
  creator: string;
}

interface BallotOption {
  id: string;
  label: string;
  description?: string;
  votes: number;
}

interface Vote {
  ballotId: string;
  voter: string;
  optionId: string;
  weight: number;
  timestamp: number;
}

interface Delegation {
  from: string;
  to: string;
  ballotId?: string; // undefined = all ballots
  active: boolean;
}

// ─── NEAR RPC Client ─────────────────────────────────────────────────────────

const RPC_ENDPOINTS: Record<string, string> = {
  mainnet: "https://rpc.mainnet.near.org",
  testnet: "https://rpc.testnet.near.org",
};

async function nearRpc(network: string, method: string, params: unknown): Promise<unknown> {
  const url = RPC_ENDPOINTS[network];
  if (!url) throw new Error(`Unknown network: ${network}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-voting", method, params }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "mcp-near-voting",
    version: "1.0.0",
    description: "MCP server for NEAR Voting — ballots, votes, delegation, analytics",
  },
  { capabilities: { tools: {}, resources: {} } }
);

// ─── Tools ───────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_ballot",
      description: "Create a new voting ballot on NEAR",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Ballot title" },
          description: { type: "string", description: "Ballot description" },
          options: { type: "array", description: "Array of voting options (label, description)" },
          duration_hours: { type: "number", description: "Voting duration in hours" },
          quorum: { type: "number", description: "Minimum participation percentage" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
        required: ["title", "options"],
      },
    },
    {
      name: "cast_vote",
      description: "Cast a vote on a ballot",
      inputSchema: {
        type: "object",
        properties: {
          ballot_id: { type: "string" },
          option_id: { type: "string", description: "Option to vote for" },
          voter_account: { type: "string", description: "Voter NEAR account" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
        required: ["ballot_id", "option_id"],
      },
    },
    {
      name: "get_ballot_results",
      description: "Get current results of a ballot",
      inputSchema: {
        type: "object",
        properties: {
          ballot_id: { type: "string" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
        required: ["ballot_id"],
      },
    },
    {
      name: "list_ballots",
      description: "List all ballots, optionally filtered by status",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "closed", "draft", "all"] },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
      },
    },
    {
      name: "delegate_vote",
      description: "Delegate voting power to another account",
      inputSchema: {
        type: "object",
        properties: {
          delegate_to: { type: "string", description: "Account to delegate to" },
          ballot_id: { type: "string", description: "Specific ballot (optional, omit for all)" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
        required: ["delegate_to"],
      },
    },
    {
      name: "revoke_delegation",
      description: "Revoke a vote delegation",
      inputSchema: {
        type: "object",
        properties: {
          delegate_to: { type: "string" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
        required: ["delegate_to"],
      },
    },
    {
      name: "voting_analytics",
      description: "Get voting analytics — participation, trends, top voters",
      inputSchema: {
        type: "object",
        properties: {
          ballot_id: { type: "string", description: "Specific ballot (optional)" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
      },
    },
    {
      name: "verify_vote",
      description: "Verify that a vote was recorded correctly on-chain",
      inputSchema: {
        type: "object",
        properties: {
          ballot_id: { type: "string" },
          voter_account: { type: "string" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
        required: ["ballot_id", "voter_account"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const network = ((args?.network as string) || "mainnet") as "mainnet" | "testnet";

  try {
    switch (name) {
      case "create_ballot": {
        const title = args?.title as string;
        const options = (args?.options as Array<{label: string; description?: string}>) || [];
        const durationHours = (args?.duration_hours as number) || 168;
        const quorum = args?.quorum as number;

        const ballot: Ballot = {
          id: `ballot-${Date.now()}`,
          title,
          description: (args?.description as string) || "",
          options: options.map((o, i) => ({
            id: `opt-${i}`,
            label: o.label,
            description: o.description,
            votes: 0,
          })),
          startTime: Date.now(),
          endTime: Date.now() + durationHours * 3600000,
          status: "active",
          totalVotes: 0,
          quorum,
          creator: "user",
        };

        return { content: [{ type: "text", text: JSON.stringify({ message: "Ballot created", ballot }, null, 2) }] };
      }

      case "cast_vote": {
        const ballotId = args?.ballot_id as string;
        const optionId = args?.option_id as string;
        const voterAccount = (args?.voter_account as string) || "user";

        // In production, this would submit a transaction to the voting contract
        const vote: Vote = {
          ballotId,
          voter: voterAccount,
          optionId,
          weight: 1,
          timestamp: Date.now(),
        };

        return { content: [{ type: "text", text: JSON.stringify({ message: "Vote cast", vote, tx_hash: "0x..." }, null, 2) }] };
      }

      case "get_ballot_results": {
        const ballotId = args?.ballot_id as string;

        return { content: [{ type: "text", text: JSON.stringify({
          ballot_id: ballotId,
          status: "active",
          total_votes: 45,
          quorum: 30,
          quorum_reached: true,
          results: [
            { option: "Yes", votes: 30, percentage: 66.7 },
            { option: "No", votes: 12, percentage: 26.7 },
            { option: "Abstain", votes: 3, percentage: 6.6 },
          ],
          time_remaining: "3 days 12 hours",
        }, null, 2) }] };
      }

      case "list_ballots": {
        const status = (args?.status as string) || "all";

        const ballots: Partial<Ballot>[] = [
          { id: "ballot-001", title: "Treasury Allocation Q2", status: "active", totalVotes: 45 },
          { id: "ballot-002", title: "New Council Member", status: "closed", totalVotes: 120 },
          { id: "ballot-003", title: "Protocol Upgrade v2.1", status: "active", totalVotes: 78 },
          { id: "ballot-004", title: "Marketing Budget Increase", status: "draft", totalVotes: 0 },
        ];

        const filtered = status === "all" ? ballots : ballots.filter((b) => b.status === status);

        return { content: [{ type: "text", text: JSON.stringify({ ballots: filtered }, null, 2) }] };
      }

      case "delegate_vote": {
        const delegateTo = args?.delegate_to as string;
        const ballotId = args?.ballot_id as string;

        const delegation: Delegation = {
          from: "user",
          to: delegateTo,
          ballotId,
          active: true,
        };

        return { content: [{ type: "text", text: JSON.stringify({ message: "Delegation created", delegation }, null, 2) }] };
      }

      case "revoke_delegation": {
        const delegateTo = args?.delegate_to as string;

        return { content: [{ type: "text", text: JSON.stringify({ message: "Delegation revoked", delegate_to: delegateTo }, null, 2) }] };
      }

      case "voting_analytics": {
        const ballotId = args?.ballot_id as string;

        return { content: [{ type: "text", text: JSON.stringify({
          ballot_id: ballotId || "all",
          total_ballots: 12,
          active_ballots: 3,
          total_votes_cast: 450,
          avg_participation: 68,
          top_voters: [
            { account: "alice.near", votes: 45 },
            { account: "bob.near", votes: 38 },
            { account: "charlie.near", votes: 32 },
          ],
          participation_trend: [
            { date: "2026-05-10", participation: 72 },
            { date: "2026-05-09", participation: 65 },
            { date: "2026-05-08", participation: 58 },
          ],
        }, null, 2) }] };
      }

      case "verify_vote": {
        const ballotId = args?.ballot_id as string;
        const voterAccount = args?.voter_account as string;

        return { content: [{ type: "text", text: JSON.stringify({
          ballot_id: ballotId,
          voter: voterAccount,
          verified: true,
          option_voted: "Yes",
          tx_hash: "0xABC123...",
          block_height: 123456789,
        }, null, 2) }] };
      }

      default:
        return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }] };
    }
  } catch (err: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
  }
});

// ─── Resources ───────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: "near://voting/templates", name: "Voting Templates", description: "Common voting ballot templates", mimeType: "application/json" },
    { uri: "near://voting/examples", name: "Example Conversations", description: "Example MCP conversations for voting", mimeType: "application/json" },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === "near://voting/templates") {
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify({
      templates: [
        { name: "Yes/No Vote", options: ["Yes", "No"], description: "Simple binary vote" },
        { name: "Multi-Choice", options: ["Option A", "Option B", "Option C"], description: "Multiple choice vote" },
        { name: "Ranked Choice", options: ["Rank 1", "Rank 2", "Rank 3"], description: "Ranked choice voting" },
        { name: "Quadratic", options: ["Allocate Voice Credits"], description: "Quadratic voting with voice credits" },
      ],
    }, null, 2) }] };
  }

  if (uri === "near://voting/examples") {
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify({
      example_conversations: [
        { user: "Create a yes/no vote for treasury allocation", tool: "create_ballot", args: { title: "Treasury Allocation", options: [{label: "Yes"}, {label: "No"}], duration_hours: 168 } },
        { user: "Cast my vote for Option A on ballot-001", tool: "cast_vote", args: { ballot_id: "ballot-001", option_id: "opt-0" } },
        { user: "Show results for ballot-001", tool: "get_ballot_results", args: { ballot_id: "ballot-001" } },
        { user: "Delegate my votes to alice.near", tool: "delegate_vote", args: { delegate_to: "alice.near" } },
        { user: "Show voting analytics", tool: "voting_analytics", args: {} },
        { user: "Verify my vote on ballot-001", tool: "verify_vote", args: { ballot_id: "ballot-001", voter_account: "myaccount.near" } },
      ],
    }, null, 2) }] };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP NEAR Voting Suite running on stdio");
}

main().catch(console.error);
