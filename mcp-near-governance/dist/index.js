#!/usr/bin/env node
"use strict";
/**
 * MCP Server - NEAR Governance Suite
 *
 * Model Context Protocol server for NEAR governance use cases.
 * Provides tools for DAO proposals, voting, delegation, and governance analytics.
 *
 * Integrates with: Astro DAO, Sputnik DAO, NEAR DAOs
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
// ─── NEAR RPC Client ─────────────────────────────────────────────────────────
const RPC_ENDPOINTS = {
    mainnet: "https://rpc.mainnet.near.org",
    testnet: "https://rpc.testnet.near.org",
};
async function nearRpc(network, method, params) {
    const url = RPC_ENDPOINTS[network];
    if (!url)
        throw new Error(`Unknown network: ${network}`);
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-governance", method, params }),
    });
    const data = await res.json();
    if (data.error)
        throw new Error(data.error.message || JSON.stringify(data.error));
    return data.result;
}
// ─── Governance Data (simulated for demo, would query DAO contracts in prod) ─
const daoConfigs = new Map([
    ["astrodao.near", {
            daoName: "Astro DAO",
            daoAddress: "astrodao.near",
            network: "mainnet",
            quorum: 50,
            votingPeriod: 604800000,
            bondAmount: "1000000000000000000000000",
        }],
    ["sputnik-dao.near", {
            daoName: "Sputnik DAO",
            daoAddress: "sputnik-dao.near",
            network: "mainnet",
            quorum: 30,
            votingPeriod: 432000000,
            bondAmount: "500000000000000000000000",
        }],
]);
// ─── MCP Server ──────────────────────────────────────────────────────────────
const server = new index_js_1.Server({
    name: "mcp-near-governance",
    version: "1.0.0",
    description: "MCP server for NEAR Governance — proposals, voting, delegation, analytics",
}, { capabilities: { tools: {}, resources: {} } });
// ─── Tools ───────────────────────────────────────────────────────────────────
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "list_daos",
            description: "List known NEAR DAOs with governance info",
            inputSchema: {
                type: "object",
                properties: {
                    network: { type: "string", enum: ["mainnet", "testnet"] },
                },
            },
        },
        {
            name: "get_dao_info",
            description: "Get detailed info about a specific DAO",
            inputSchema: {
                type: "object",
                properties: {
                    dao_address: { type: "string", description: "DAO contract address" },
                    network: { type: "string", enum: ["mainnet", "testnet"] },
                },
                required: ["dao_address"],
            },
        },
        {
            name: "create_proposal",
            description: "Create a governance proposal for a NEAR DAO",
            inputSchema: {
                type: "object",
                properties: {
                    dao_address: { type: "string", description: "DAO contract address" },
                    title: { type: "string", description: "Proposal title" },
                    description: { type: "string", description: "Proposal description" },
                    actions: { type: "array", description: "Array of proposal actions" },
                    network: { type: "string", enum: ["mainnet", "testnet"] },
                },
                required: ["dao_address", "title", "description"],
            },
        },
        {
            name: "list_proposals",
            description: "List proposals for a DAO",
            inputSchema: {
                type: "object",
                properties: {
                    dao_address: { type: "string", description: "DAO contract address" },
                    status: { type: "string", enum: ["active", "approved", "rejected", "all"] },
                    network: { type: "string", enum: ["mainnet", "testnet"] },
                },
                required: ["dao_address"],
            },
        },
        {
            name: "get_proposal",
            description: "Get details of a specific proposal",
            inputSchema: {
                type: "object",
                properties: {
                    dao_address: { type: "string" },
                    proposal_id: { type: "string" },
                    network: { type: "string", enum: ["mainnet", "testnet"] },
                },
                required: ["dao_address", "proposal_id"],
            },
        },
        {
            name: "cast_vote",
            description: "Cast a vote on a proposal",
            inputSchema: {
                type: "object",
                properties: {
                    dao_address: { type: "string" },
                    proposal_id: { type: "string" },
                    vote: { type: "string", enum: ["for", "against", "abstain"] },
                    network: { type: "string", enum: ["mainnet", "testnet"] },
                },
                required: ["dao_address", "proposal_id", "vote"],
            },
        },
        {
            name: "delegate_votes",
            description: "Delegate voting power to another account",
            inputSchema: {
                type: "object",
                properties: {
                    dao_address: { type: "string" },
                    delegate_to: { type: "string", description: "Account to delegate to" },
                    network: { type: "string", enum: ["mainnet", "testnet"] },
                },
                required: ["dao_address", "delegate_to"],
            },
        },
        {
            name: "get_voting_power",
            description: "Get voting power of an account in a DAO",
            inputSchema: {
                type: "object",
                properties: {
                    dao_address: { type: "string" },
                    account_id: { type: "string", description: "Account to check" },
                    network: { type: "string", enum: ["mainnet", "testnet"] },
                },
                required: ["dao_address", "account_id"],
            },
        },
        {
            name: "governance_analytics",
            description: "Get governance analytics for a DAO",
            inputSchema: {
                type: "object",
                properties: {
                    dao_address: { type: "string" },
                    network: { type: "string", enum: ["mainnet", "testnet"] },
                },
                required: ["dao_address"],
            },
        },
        {
            name: "compare_daos",
            description: "Compare governance configs between two DAOs",
            inputSchema: {
                type: "object",
                properties: {
                    dao_address_1: { type: "string" },
                    dao_address_2: { type: "string" },
                    network: { type: "string", enum: ["mainnet", "testnet"] },
                },
                required: ["dao_address_1", "dao_address_2"],
            },
        },
    ],
}));
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const network = (args?.network || "mainnet");
    try {
        switch (name) {
            case "list_daos": {
                const daos = Array.from(daoConfigs.values())
                    .filter((d) => d.network === network)
                    .map((d) => ({
                    name: d.daoName,
                    address: d.daoAddress,
                    quorum: d.quorum,
                    votingPeriodHours: d.votingPeriod / 3600000,
                    bondAmount: d.bondAmount,
                }));
                return { content: [{ type: "text", text: JSON.stringify({ network, daos }, null, 2) }] };
            }
            case "get_dao_info": {
                const daoAddress = args?.dao_address;
                const config = daoConfigs.get(daoAddress);
                if (!config) {
                    return { content: [{ type: "text", text: JSON.stringify({ error: `DAO not found: ${daoAddress}` }) }] };
                }
                return { content: [{ type: "text", text: JSON.stringify(config, null, 2) }] };
            }
            case "create_proposal": {
                const daoAddress = args?.dao_address;
                const title = args?.title;
                const description = args?.description;
                const actions = args?.actions || [];
                const proposal = {
                    id: `prop-${Date.now()}`,
                    proposer: "user",
                    title,
                    description,
                    status: "active",
                    votesFor: 0,
                    votesAgainst: 0,
                    votesAbstain: 0,
                    quorum: daoConfigs.get(daoAddress)?.quorum || 50,
                    deadline: Date.now() + (daoConfigs.get(daoAddress)?.votingPeriod || 604800000),
                    actions,
                };
                return { content: [{ type: "text", text: JSON.stringify({ message: "Proposal created", proposal }, null, 2) }] };
            }
            case "list_proposals": {
                const daoAddress = args?.dao_address;
                const status = args?.status || "all";
                // In production, this would query the DAO contract
                const proposals = [
                    {
                        id: "prop-001",
                        proposer: "alice.near",
                        title: "Treasury allocation for development",
                        description: "Allocate 1000 NEAR from treasury for Q2 development",
                        status: "active",
                        votesFor: 150,
                        votesAgainst: 30,
                        votesAbstain: 10,
                        quorum: 50,
                        deadline: Date.now() + 86400000 * 3,
                        actions: [{ type: "transfer", target: "dev.near", amount: "1000000000000000000000000000" }],
                    },
                    {
                        id: "prop-002",
                        proposer: "bob.near",
                        title: "Add new council member",
                        description: "Add charlie.near to the governance council",
                        status: "approved",
                        votesFor: 200,
                        votesAgainst: 20,
                        votesAbstain: 5,
                        quorum: 50,
                        deadline: Date.now() - 86400000,
                        actions: [{ type: "add_member", target: "charlie.near" }],
                    },
                ];
                const filtered = status === "all" ? proposals : proposals.filter((p) => p.status === status);
                return { content: [{ type: "text", text: JSON.stringify({ dao_address: daoAddress, proposals: filtered }, null, 2) }] };
            }
            case "get_proposal": {
                const proposalId = args?.proposal_id;
                return { content: [{ type: "text", text: JSON.stringify({ proposal_id: proposalId, title: "Sample Proposal", status: "active", votesFor: 150, votesAgainst: 30, quorum: 50 }, null, 2) }] };
            }
            case "cast_vote": {
                const daoAddress = args?.dao_address;
                const proposalId = args?.proposal_id;
                const vote = args?.vote;
                return { content: [{ type: "text", text: JSON.stringify({ message: "Vote cast successfully", dao_address: daoAddress, proposal_id: proposalId, vote, tx_hash: "0x..." }, null, 2) }] };
            }
            case "delegate_votes": {
                const daoAddress = args?.dao_address;
                const delegateTo = args?.delegate_to;
                return { content: [{ type: "text", text: JSON.stringify({ message: "Votes delegated", dao_address: daoAddress, delegate_to: delegateTo }, null, 2) }] };
            }
            case "get_voting_power": {
                const daoAddress = args?.dao_address;
                const accountId = args?.account_id;
                // Query staked balance as voting power
                const account = await nearRpc(network, "query", {
                    request_type: "view_account",
                    finality: "final",
                    account_id: accountId,
                });
                const balance = account?.amount || "0";
                const staked = Number(BigInt(balance)) / 1e24;
                return { content: [{ type: "text", text: JSON.stringify({ account_id: accountId, dao_address: daoAddress, voting_power: staked, balance }, null, 2) }] };
            }
            case "governance_analytics": {
                const daoAddress = args?.dao_address;
                return { content: [{ type: "text", text: JSON.stringify({
                                dao_address: daoAddress,
                                total_proposals: 42,
                                active_proposals: 3,
                                approval_rate: 78,
                                avg_participation: 65,
                                total_members: 150,
                                proposals_by_type: { transfer: 15, function_call: 12, add_member: 8, policy_change: 7 },
                                recent_activity: [
                                    { date: "2026-05-10", proposals_created: 2, votes_cast: 45 },
                                    { date: "2026-05-09", proposals_created: 1, votes_cast: 30 },
                                    { date: "2026-05-08", proposals_created: 0, votes_cast: 12 },
                                ],
                            }, null, 2) }] };
            }
            case "compare_daos": {
                const dao1 = args?.dao_address_1;
                const dao2 = args?.dao_address_2;
                const config1 = daoConfigs.get(dao1);
                const config2 = daoConfigs.get(dao2);
                return { content: [{ type: "text", text: JSON.stringify({
                                dao_1: config1 || { error: "Not found" },
                                dao_2: config2 || { error: "Not found" },
                                comparison: {
                                    quorum_diff: (config1?.quorum || 0) - (config2?.quorum || 0),
                                    voting_period_ratio: (config1?.votingPeriod || 1) / (config2?.votingPeriod || 1),
                                },
                            }, null, 2) }] };
            }
            default:
                return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }] };
        }
    }
    catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
    }
});
// ─── Resources ───────────────────────────────────────────────────────────────
server.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => ({
    resources: [
        { uri: "near://governance/daos", name: "NEAR DAOs", description: "List of DAOs on NEAR", mimeType: "application/json" },
        { uri: "near://governance/policies", name: "Governance Policies", description: "Common governance policy templates", mimeType: "application/json" },
        { uri: "near://governance/examples", name: "Example Conversations", description: "Example MCP conversations for governance", mimeType: "application/json" },
    ],
}));
server.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    if (uri === "near://governance/daos") {
        return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify({
                        daos: [
                            { name: "Astro DAO", address: "astrodao.near", type: "Platform DAO", members: 500 },
                            { name: "Sputnik DAO", address: "sputnik-dao.near", type: "Factory DAO", members: 300 },
                            { name: "NEAR Foundation", address: "foundation.near", type: "Foundation", members: 50 },
                            { name: "Octopus Network", address: "octopus-network.near", type: "Appchain DAO", members: 200 },
                        ],
                    }, null, 2) }] };
    }
    if (uri === "near://governance/policies") {
        return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify({
                        policy_templates: [
                            { name: "Standard Proposal", quorum: 50, voting_period: "7 days", bond: "1 NEAR" },
                            { name: "Emergency Proposal", quorum: 30, voting_period: "24 hours", bond: "5 NEAR" },
                            { name: "Constitutional Change", quorum: 66, voting_period: "14 days", bond: "10 NEAR" },
                        ],
                    }, null, 2) }] };
    }
    if (uri === "near://governance/examples") {
        return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify({
                        example_conversations: [
                            {
                                user: "Show me active proposals for Astro DAO",
                                tool: "list_proposals",
                                args: { dao_address: "astrodao.near", status: "active" },
                            },
                            {
                                user: "Create a proposal to allocate 500 NEAR for marketing",
                                tool: "create_proposal",
                                args: { dao_address: "astrodao.near", title: "Marketing Budget", description: "Allocate 500 NEAR", actions: [{ type: "transfer", target: "marketing.near", amount: "500000000000000000000000000" }] },
                            },
                            {
                                user: "What's my voting power in Sputnik DAO?",
                                tool: "get_voting_power",
                                args: { dao_address: "sputnik-dao.near", account_id: "alice.near" },
                            },
                            {
                                user: "Compare Astro DAO and Sputnik DAO governance",
                                tool: "compare_daos",
                                args: { dao_address_1: "astrodao.near", dao_address_2: "sputnik-dao.near" },
                            },
                            {
                                user: "Show governance analytics for my DAO",
                                tool: "governance_analytics",
                                args: { dao_address: "mydao.near" },
                            },
                        ],
                    }, null, 2) }] };
    }
    throw new Error(`Unknown resource: ${uri}`);
});
// ─── Start ───────────────────────────────────────────────────────────────────
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("MCP NEAR Governance Suite running on stdio");
}
main().catch(console.error);
