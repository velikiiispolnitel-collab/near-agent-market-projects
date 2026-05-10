/**
 * near-account-utils - Utilities for NEAR account management
 *
 * Provides account ID validation, formatting, implicit vs named account detection,
 * access key utilities, and batch account operations.
 */
export declare function isValidAccountId(accountId: string): boolean;
export declare function isImplicitAccount(accountId: string): boolean;
export declare function isNamedAccount(accountId: string): boolean;
export declare function formatAccountId(accountId: string, maxLength?: number): string;
export declare function getTLD(accountId: string): string | null;
export declare function getParentAccount(accountId: string): string | null;
export declare function getSubAccountName(accountId: string): string | null;
export declare function normalizeAccountId(accountId: string): string;
export declare function publicKeyToImplicitAccount(publicKey: string): string;
export interface BatchResult<T> {
    success: T[];
    failed: {
        input: string;
        error: string;
    }[];
}
export declare function batchValidateAccounts(accountIds: string[]): BatchResult<string>;
export declare function batchFilterByType(accountIds: string[], type: 'implicit' | 'named'): BatchResult<string>;
export interface AccessKeyInfo {
    publicKey: string;
    permission: 'FullAccess' | {
        FunctionCall: {
            allowance: string;
            receiverId: string;
            methodNames: string[];
        };
    };
}
export declare function isFullAccessKey(permission: AccessKeyInfo['permission']): boolean;
export declare function isFunctionCallKey(permission: AccessKeyInfo['permission']): boolean;
export declare function formatAccessKeyPermission(permission: AccessKeyInfo['permission']): string;
export declare function accountsEqual(a: string, b: string): boolean;
export declare function sortAccounts(accountIds: string[]): string[];
export declare function filterByTLD(accountIds: string[], tld: string): string[];
export declare function getAccountDepth(accountId: string): number;
export declare function isSubAccount(accountId: string): boolean;
declare const _default: {
    isValidAccountId: typeof isValidAccountId;
    isImplicitAccount: typeof isImplicitAccount;
    isNamedAccount: typeof isNamedAccount;
    formatAccountId: typeof formatAccountId;
    getTLD: typeof getTLD;
    getParentAccount: typeof getParentAccount;
    getSubAccountName: typeof getSubAccountName;
    normalizeAccountId: typeof normalizeAccountId;
    publicKeyToImplicitAccount: typeof publicKeyToImplicitAccount;
    batchValidateAccounts: typeof batchValidateAccounts;
    batchFilterByType: typeof batchFilterByType;
    isFullAccessKey: typeof isFullAccessKey;
    isFunctionCallKey: typeof isFunctionCallKey;
    formatAccessKeyPermission: typeof formatAccessKeyPermission;
    accountsEqual: typeof accountsEqual;
    sortAccounts: typeof sortAccounts;
    filterByTLD: typeof filterByTLD;
    getAccountDepth: typeof getAccountDepth;
    isSubAccount: typeof isSubAccount;
};
export default _default;
//# sourceMappingURL=index.d.ts.map