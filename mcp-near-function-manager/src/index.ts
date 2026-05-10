#!/usr/bin/env node

/**
 * MCP Server - NEAR Function Manager
 * 
 * Model Context Protocol server for managing NEAR smart contract functions.
 * Provides CRUD operations and query capabilities for contract functions.
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

interface ContractFunction {
  name: string;
  description: string;
  methodType: "view" | "change";
  params: FunctionParam[];
  returnType?: string;
  isPayable: boolean;
  isPrivate: boolean;
}

interface FunctionParam {
  name: string;
  type: string;
  description?: string;
  required: boolean;
}

interface ContractInfo {
  accountId: string;
  network: "mainnet" | "testnet";
  functions: ContractFunction[];
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
    body: JSON.stringify({ jsonrpc: "2.0", id: "mcp-server", method, params }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

// ─── Contract Function Parser ────────────────────────────────────────────────

function parseContractCode(base64Code: string): ContractFunction[] {
  const functions: ContractFunction[] = [];
  try {
    const code = Buffer.from(base64Code, "base64").toString("utf8");
    // Simple heuristic parsing for common patterns
    const lines = code.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for function definitions
      const fnMatch = trimmed.match(/(?:export\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
      if (fnMatch) {
        const name = fnMatch[1];
        const paramsStr = fnMatch[2];
        const params: FunctionParam[] = paramsStr
          ? paramsStr.split(",").map((p) => {
              const parts = p.trim().split(":");
              return {
                name: parts[0]?.trim() || "arg",
                type: parts[1]?.trim() || "unknown",
                required: !p.includes("?"),
              };
            })
          : [];

        const isPayable = trimmed.includes("payable") || trimmed.includes("attachedDeposit");
        const isPrivate = trimmed.includes("private") || name.startsWith("_");
        const methodType = trimmed.includes("view") || trimmed.includes("const") ? "view" : "change";

        functions.push({
          name,
          description: `Contract function: ${name}`,
          methodType,
          params,
          isPayable,
          isPrivate,
        });
      }
    }
  } catch {
    // If parsing fails, return empty
  }
  return functions;
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "mcp-near-function-manager",
    version: "1.0.0",
    description: "MCP server for managing NEAR smart contract functions",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ─── Tools ───────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_functions",
      description: "List all functions in a NEAR smart contract",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "NEAR account ID (e.g. 'contract.near')" },
          network: { type: "string", enum: ["mainnet", "testnet"], description: "NEAR network" },
        },
        required: ["account_id"],
      },
    },
    {
      name: "get_function",
      description: "Get details of a specific contract function",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "NEAR account ID" },
          function_name: { type: "string", description: "Function name" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
        required: ["account_id", "function_name"],
      },
    },
    {
      name: "call_view_function",
      description: "Call a view function on a NEAR contract (read-only)",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "NEAR account ID" },
          function_name: { type: "string", description: "Function name to call" },
          args: { type: "object", description: "Function arguments as JSON object" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
        required: ["account_id", "function_name"],
      },
    },
    {
      name: "estimate_gas",
      description: "Estimate gas for a function call",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "string", description: "NEAR account ID" },
          function_name: { type: "string", description: "Function name" },
          args: { type: "object", description: "Function arguments" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
        required: ["account_id", "function_name"],
      },
    },
    {
      name: "compare_functions",
      description: "Compare functions between two contracts",
      inputSchema: {
        type: "object",
        properties: {
          account_id_1: { type: "string", description: "First NEAR account ID" },
          account_id_2: { type: "string", description: "Second NEAR account ID" },
          network: { type: "string", enum: ["mainnet", "testnet"] },
        },
        required: ["account_id_1", "account_id_2"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const accountId = (args?.account_id as string) || "";
  const network = ((args?.network as string) || "mainnet") as "mainnet" | "testnet";

  try {
    switch (name) {
      case "list_functions": {
        // Get contract code and parse functions
        const codeResult = await nearRpc(network, "query", {
          request_type: "view_code",
          finality: "final",
          account_id: accountId,
        });
        const code = (codeResult as any)?.code_base64 || "";
        const functions = parseContractCode(code);

        // Also get access keys for additional context
        const keysResult = await nearRpc(network, "query", {
          request_type: "view_access_key_list",
          finality: "final",
          account_id: accountId,
        });
        const keys = (keysResult as any)?.keys || [];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                account_id: accountId,
                network,
                total_functions: functions.length,
                view_functions: functions.filter((f) => f.methodType === "view").length,
                change_functions: functions.filter((f) => f.methodType === "change").length,
                payable_functions: functions.filter((f) => f.isPayable).length,
                access_keys: keys.length,
                functions: functions.map((f) => ({
                  name: f.name,
                  type: f.methodType,
                  params: f.params,
                  payable: f.isPayable,
                  private: f.isPrivate,
                })),
              }, null, 2),
            },
          ],
        };
      }

      case "get_function": {
        const functionName = args?.function_name as string;
        const codeResult = await nearRpc(network, "query", {
          request_type: "view_code",
          finality: "final",
          account_id: accountId,
        });
        const code = (codeResult as any)?.code_base64 || "";
        const functions = parseContractCode(code);
        const func = functions.find((f) => f.name === functionName);

        if (!func) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: `Function '${functionName}' not found in ${accountId}` }) }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ account_id: accountId, function: func }, null, 2) }],
        };
      }

      case "call_view_function": {
        const functionName = args?.function_name as string;
        const callArgs = (args?.args as Record<string, unknown>) || {};

        const result = await nearRpc(network, "query", {
          request_type: "call_function",
          finality: "final",
          account_id: accountId,
          method_name: functionName,
          args_base64: Buffer.from(JSON.stringify(callArgs)).toString("base64"),
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ account_id: accountId, function: functionName, result }, null, 2) }],
        };
      }

      case "estimate_gas": {
        const functionName = args?.function_name as string;
        const callArgs = (args?.args as Record<string, unknown>) || {};

        // Estimate gas by simulating the call
        const result = await nearRpc(network, "query", {
          request_type: "call_function",
          finality: "final",
          account_id: accountId,
          method_name: functionName,
          args_base64: Buffer.from(JSON.stringify(callArgs)).toString("base64"),
        });

        const gasUsed = (result as any)?.result?.gas_burnt || "unknown";

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              account_id: accountId,
              function: functionName,
              estimated_gas: gasUsed,
              estimated_cost: typeof gasUsed === "number" ? `${(gasUsed / 1e12).toFixed(4)} TGas` : "unknown",
            }, null, 2),
          }],
        };
      }

      case "compare_functions": {
        const accountId2 = args?.account_id_2 as string;

        const [code1, code2] = await Promise.all([
          nearRpc(network, "query", { request_type: "view_code", finality: "final", account_id: accountId }),
          nearRpc(network, "query", { request_type: "view_code", finality: "final", account_id: accountId2 }),
        ]);

        const functions1 = parseContractCode((code1 as any)?.code_base64 || "");
        const functions2 = parseContractCode((code2 as any)?.code_base64 || "");

        const names1 = new Set(functions1.map((f) => f.name));
        const names2 = new Set(functions2.map((f) => f.name));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              contract_1: { account_id: accountId, total_functions: functions1.length },
              contract_2: { account_id: accountId2, total_functions: functions2.length },
              common_functions: [...names1].filter((n) => names2.has(n)),
              only_in_contract_1: [...names1].filter((n) => !names2.has(n)),
              only_in_contract_2: [...names2].filter((n) => !names1.has(n)),
            }, null, 2),
          }],
        };
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
    {
      uri: "near://contracts/popular",
      name: "Popular NEAR Contracts",
      description: "List of popular NEAR smart contracts for reference",
      mimeType: "application/json",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "near://contracts/popular") {
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify({
          popular_contracts: [
            { name: "v2.ref-finance.near", description: "Ref Finance DEX" },
            { name: "wrap.near", description: "Wrapped NEAR" },
            { name: "token.sweat", description: "SWEAT Token" },
            { name: "paras.near", description: "Paras NFT Marketplace" },
            { name: "mintbase.near", description: "Mintbase NFT Platform" },
          ],
        }, null, 2),
      }],
    };
  }
  throw new Error(`Unknown resource: ${request.params.uri}`);
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP NEAR Function Manager running on stdio");
}

main().catch(console.error);
