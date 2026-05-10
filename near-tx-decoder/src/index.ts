/**
 * near-tx-decoder - Decode NEAR transactions into human-readable format
 * 
 * Explains what each transaction does in plain English.
 */

export type ActionType =
  | 'CreateAccount'
  | 'DeployContract'
  | 'FunctionCall'
  | 'Transfer'
  | 'Stake'
  | 'AddKey'
  | 'DeleteKey'
  | 'DeleteAccount';

export interface TxAction {
  type: ActionType;
  description: string;
  details: Record<string, unknown>;
}

export interface DecodedTransaction {
  signerId: string;
  receiverId: string;
  actions: TxAction[];
  summary: string;
  blockHash?: string;
  hash?: string;
}

// Decode a single action
export function decodeAction(action: { type: string; params: Record<string, unknown> }): TxAction {
  switch (action.type) {
    case 'CreateAccount':
      return {
        type: 'CreateAccount',
        description: 'Creates a new NEAR account',
        details: action.params,
      };

    case 'DeployContract':
      return {
        type: 'DeployContract',
        description: `Deploys a contract to ${(action.params as any).accountId || 'an account'}`,
        details: action.params,
      };

    case 'FunctionCall': {
      const params = action.params as any;
      const methodName = params.methodName || 'unknown';
      const args = params.args ? Buffer.from(params.args, 'base64').toString('utf8') : '';
      let parsedArgs = args;
      try { parsedArgs = JSON.parse(args); } catch {}
      
      return {
        type: 'FunctionCall',
        description: `Calls ${methodName}() on ${params.receiverId || 'a contract'}`,
        details: { methodName, args: parsedArgs, gas: params.gas, deposit: params.deposit },
      };
    }

    case 'Transfer': {
      const params = action.params as any;
      const deposit = formatNearAmount(params.deposit || '0');
      return {
        type: 'Transfer',
        description: `Transfers ${deposit} to ${(action.params as any).receiverId || 'recipient'}`,
        details: { deposit: params.deposit, formattedDeposit: deposit },
      };
    }

    case 'Stake': {
      const params = action.params as any;
      return {
        type: 'Stake',
        description: `Stakes ${formatNearAmount(params.stake || '0')}`,
        details: { stake: params.stake, publicKey: params.publicKey },
      };
    }

    case 'AddKey': {
      const params = action.params as any;
      return {
        type: 'AddKey',
        description: `Adds an access key (${formatPermission(params.accessKey?.permission)})`,
        details: params,
      };
    }

    case 'DeleteKey': {
      const params = action.params as any;
      return {
        type: 'DeleteKey',
        description: `Removes access key for ${params.publicKey || 'a key'}`,
        details: params,
      };
    }

    case 'DeleteAccount': {
      const params = action.params as any;
      return {
        type: 'DeleteAccount',
        description: `Deletes account, transferring remaining balance to ${params.beneficiaryId || 'beneficiary'}`,
        details: params,
      };
    }

    default:
      return {
        type: action.type as ActionType,
        description: `Unknown action: ${action.type}`,
        details: action.params,
      };
  }
}

// Decode full transaction
export function decodeTransaction(tx: {
  signerId?: string;
  receiverId?: string;
  actions: Array<{ type: string; params: Record<string, unknown> }>;
  hash?: string;
  blockHash?: string;
}): DecodedTransaction {
  const actions = tx.actions.map(decodeAction);
  const summary = actions.map(a => a.description).join('; ');

  return {
    signerId: tx.signerId || 'unknown',
    receiverId: tx.receiverId || 'unknown',
    actions,
    summary,
    hash: tx.hash,
    blockHash: tx.blockHash,
  };
}

// Format yoctoNEAR to NEAR
export function formatNearAmount(yoctoNear: string | number): string {
  const amount = typeof yoctoNear === 'string' ? BigInt(yoctoNear) : BigInt(yoctoNear);
  const near = Number(amount) / 1e24;
  
  if (near >= 1000) return `${(near / 1000).toFixed(2)}K NEAR`;
  if (near >= 1) return `${near.toFixed(4)} NEAR`;
  if (near >= 0.001) return `${(near * 1000).toFixed(2)} mNEAR`;
  return `${yoctoNear} yoctoNEAR`;
}

// Format permission for display
export function formatPermission(permission: string | Record<string, unknown>): string {
  if (permission === 'FullAccess') return 'Full Access';
  if (typeof permission === 'object' && permission !== null) {
    const p = permission as any;
    if (p.FunctionCall) {
      return `Function Call (${p.FunctionCall.methodNames?.length || 0} methods on ${p.FunctionCall.receiverId})`;
    }
  }
  return 'Unknown';
}

// Generate human-readable summary
export function summarizeTransaction(tx: DecodedTransaction): string {
  const parts: string[] = [];
  
  parts.push(`${tx.signerId} → ${tx.receiverId}`);
  
  for (const action of tx.actions) {
    parts.push(`  • ${action.description}`);
  }
  
  return parts.join('\n');
}

// ABI registry for known contracts
export interface ABIRegistry {
  [contractId: string]: {
    methods: Record<string, { description: string; params?: string[] }>;
  };
}

const knownContracts: ABIRegistry = {
  'v2.ref-finance.near': {
    methods: {
      swap: { description: 'Swap tokens on Ref Finance' },
      add_liquidity: { description: 'Add liquidity to a pool' },
      remove_liquidity: { description: 'Remove liquidity from a pool' },
    },
  },
  'wrap.near': {
    methods: {
      near_deposit: { description: 'Wrap NEAR to wNEAR' },
      near_withdraw: { description: 'Unwrap wNEAR to NEAR' },
    },
  },
};

// Look up known method
export function lookupMethod(contractId: string, methodName: string): string | null {
  const contract = knownContracts[contractId];
  if (!contract) return null;
  return contract.methods[methodName]?.description || null;
}

// Register custom ABI
export function registerABI(contractId: string, abi: ABIRegistry[string]): void {
  knownContracts[contractId] = abi;
}

export default {
  decodeAction,
  decodeTransaction,
  formatNearAmount,
  formatPermission,
  summarizeTransaction,
  lookupMethod,
  registerABI,
};
