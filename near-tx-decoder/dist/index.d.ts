/**
 * near-tx-decoder - Decode NEAR transactions into human-readable format
 *
 * Explains what each transaction does in plain English.
 */
export type ActionType = 'CreateAccount' | 'DeployContract' | 'FunctionCall' | 'Transfer' | 'Stake' | 'AddKey' | 'DeleteKey' | 'DeleteAccount';
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
export declare function decodeAction(action: {
    type: string;
    params: Record<string, unknown>;
}): TxAction;
export declare function decodeTransaction(tx: {
    signerId?: string;
    receiverId?: string;
    actions: Array<{
        type: string;
        params: Record<string, unknown>;
    }>;
    hash?: string;
    blockHash?: string;
}): DecodedTransaction;
export declare function formatNearAmount(yoctoNear: string | number): string;
export declare function formatPermission(permission: string | Record<string, unknown>): string;
export declare function summarizeTransaction(tx: DecodedTransaction): string;
export interface ABIRegistry {
    [contractId: string]: {
        methods: Record<string, {
            description: string;
            params?: string[];
        }>;
    };
}
export declare function lookupMethod(contractId: string, methodName: string): string | null;
export declare function registerABI(contractId: string, abi: ABIRegistry[string]): void;
declare const _default: {
    decodeAction: typeof decodeAction;
    decodeTransaction: typeof decodeTransaction;
    formatNearAmount: typeof formatNearAmount;
    formatPermission: typeof formatPermission;
    summarizeTransaction: typeof summarizeTransaction;
    lookupMethod: typeof lookupMethod;
    registerABI: typeof registerABI;
};
export default _default;
