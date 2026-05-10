"use strict";
/**
 * near-tx-decoder - Decode NEAR transactions into human-readable format
 *
 * Explains what each transaction does in plain English.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeAction = decodeAction;
exports.decodeTransaction = decodeTransaction;
exports.formatNearAmount = formatNearAmount;
exports.formatPermission = formatPermission;
exports.summarizeTransaction = summarizeTransaction;
exports.lookupMethod = lookupMethod;
exports.registerABI = registerABI;
// Decode a single action
function decodeAction(action) {
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
                description: `Deploys a contract to ${action.params.accountId || 'an account'}`,
                details: action.params,
            };
        case 'FunctionCall': {
            const params = action.params;
            const methodName = params.methodName || 'unknown';
            const args = params.args ? Buffer.from(params.args, 'base64').toString('utf8') : '';
            let parsedArgs = args;
            try {
                parsedArgs = JSON.parse(args);
            }
            catch { }
            return {
                type: 'FunctionCall',
                description: `Calls ${methodName}() on ${params.receiverId || 'a contract'}`,
                details: { methodName, args: parsedArgs, gas: params.gas, deposit: params.deposit },
            };
        }
        case 'Transfer': {
            const params = action.params;
            const deposit = formatNearAmount(params.deposit || '0');
            return {
                type: 'Transfer',
                description: `Transfers ${deposit} to ${action.params.receiverId || 'recipient'}`,
                details: { deposit: params.deposit, formattedDeposit: deposit },
            };
        }
        case 'Stake': {
            const params = action.params;
            return {
                type: 'Stake',
                description: `Stakes ${formatNearAmount(params.stake || '0')}`,
                details: { stake: params.stake, publicKey: params.publicKey },
            };
        }
        case 'AddKey': {
            const params = action.params;
            return {
                type: 'AddKey',
                description: `Adds an access key (${formatPermission(params.accessKey?.permission)})`,
                details: params,
            };
        }
        case 'DeleteKey': {
            const params = action.params;
            return {
                type: 'DeleteKey',
                description: `Removes access key for ${params.publicKey || 'a key'}`,
                details: params,
            };
        }
        case 'DeleteAccount': {
            const params = action.params;
            return {
                type: 'DeleteAccount',
                description: `Deletes account, transferring remaining balance to ${params.beneficiaryId || 'beneficiary'}`,
                details: params,
            };
        }
        default:
            return {
                type: action.type,
                description: `Unknown action: ${action.type}`,
                details: action.params,
            };
    }
}
// Decode full transaction
function decodeTransaction(tx) {
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
function formatNearAmount(yoctoNear) {
    const amount = typeof yoctoNear === 'string' ? BigInt(yoctoNear) : BigInt(yoctoNear);
    const near = Number(amount) / 1e24;
    if (near >= 1000)
        return `${(near / 1000).toFixed(2)}K NEAR`;
    if (near >= 1)
        return `${near.toFixed(4)} NEAR`;
    if (near >= 0.001)
        return `${(near * 1000).toFixed(2)} mNEAR`;
    return `${yoctoNear} yoctoNEAR`;
}
// Format permission for display
function formatPermission(permission) {
    if (permission === 'FullAccess')
        return 'Full Access';
    if (typeof permission === 'object' && permission !== null) {
        const p = permission;
        if (p.FunctionCall) {
            return `Function Call (${p.FunctionCall.methodNames?.length || 0} methods on ${p.FunctionCall.receiverId})`;
        }
    }
    return 'Unknown';
}
// Generate human-readable summary
function summarizeTransaction(tx) {
    const parts = [];
    parts.push(`${tx.signerId} → ${tx.receiverId}`);
    for (const action of tx.actions) {
        parts.push(`  • ${action.description}`);
    }
    return parts.join('\n');
}
const knownContracts = {
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
function lookupMethod(contractId, methodName) {
    const contract = knownContracts[contractId];
    if (!contract)
        return null;
    return contract.methods[methodName]?.description || null;
}
// Register custom ABI
function registerABI(contractId, abi) {
    knownContracts[contractId] = abi;
}
exports.default = {
    decodeAction,
    decodeTransaction,
    formatNearAmount,
    formatPermission,
    summarizeTransaction,
    lookupMethod,
    registerABI,
};
