"use strict";
/**
 * near-account-utils - Utilities for NEAR account management
 *
 * Provides account ID validation, formatting, implicit vs named account detection,
 * access key utilities, and batch account operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidAccountId = isValidAccountId;
exports.isImplicitAccount = isImplicitAccount;
exports.isNamedAccount = isNamedAccount;
exports.formatAccountId = formatAccountId;
exports.getTLD = getTLD;
exports.getParentAccount = getParentAccount;
exports.getSubAccountName = getSubAccountName;
exports.normalizeAccountId = normalizeAccountId;
exports.publicKeyToImplicitAccount = publicKeyToImplicitAccount;
exports.batchValidateAccounts = batchValidateAccounts;
exports.batchFilterByType = batchFilterByType;
exports.isFullAccessKey = isFullAccessKey;
exports.isFunctionCallKey = isFunctionCallKey;
exports.formatAccessKeyPermission = formatAccessKeyPermission;
exports.accountsEqual = accountsEqual;
exports.sortAccounts = sortAccounts;
exports.filterByTLD = filterByTLD;
exports.getAccountDepth = getAccountDepth;
exports.isSubAccount = isSubAccount;
// NEAR account validation
function isValidAccountId(accountId) {
    if (!accountId || typeof accountId !== 'string')
        return false;
    // NEAR account IDs must be 2-64 characters
    if (accountId.length < 2 || accountId.length > 64)
        return false;
    // Implicit accounts are exactly 64 hex characters
    if (accountId.length === 64) {
        return /^[a-f0-9]{64}$/.test(accountId);
    }
    // Named accounts: lowercase alphanumeric, dots, hyphens, underscores
    // Must not start or end with separator
    if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(accountId))
        return false;
    // No consecutive separators
    if (/[._-]{2,}/.test(accountId))
        return false;
    // Each segment must be non-empty
    const segments = accountId.split(/[._-]/);
    return segments.every(s => s.length > 0);
}
// Detect if account is implicit (64 hex chars)
function isImplicitAccount(accountId) {
    return /^[a-f0-9]{64}$/.test(accountId);
}
// Detect if account is a named account
function isNamedAccount(accountId) {
    return isValidAccountId(accountId) && !isImplicitAccount(accountId);
}
// Format account ID for display (truncate middle)
function formatAccountId(accountId, maxLength = 24) {
    if (!accountId)
        return '';
    if (accountId.length <= maxLength)
        return accountId;
    const half = Math.floor((maxLength - 3) / 2);
    return `${accountId.slice(0, half)}...${accountId.slice(-half)}`;
}
// Get top-level domain (TLD) from account ID
function getTLD(accountId) {
    if (!isValidAccountId(accountId))
        return null;
    const parts = accountId.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : null;
}
// Get parent account (everything after first dot)
function getParentAccount(accountId) {
    if (!isValidAccountId(accountId))
        return null;
    const dotIndex = accountId.indexOf('.');
    return dotIndex > 0 ? accountId.slice(dotIndex + 1) : null;
}
// Get sub-account name (everything before first dot)
function getSubAccountName(accountId) {
    if (!isValidAccountId(accountId))
        return null;
    const dotIndex = accountId.indexOf('.');
    return dotIndex > 0 ? accountId.slice(0, dotIndex) : accountId;
}
// Validate and normalize account ID
function normalizeAccountId(accountId) {
    const trimmed = accountId.trim().toLowerCase();
    if (!isValidAccountId(trimmed)) {
        throw new Error(`Invalid NEAR account ID: ${accountId}`);
    }
    return trimmed;
}
// Generate implicit account ID from public key (simplified)
function publicKeyToImplicitAccount(publicKey) {
    // Remove ed25519: prefix if present
    const key = publicKey.replace(/^ed25519:/, '');
    // In real implementation, this would be SHA-256 hash
    // For now, return padded/truncated key
    return key.padEnd(64, '0').slice(0, 64).toLowerCase();
}
function batchValidateAccounts(accountIds) {
    const result = { success: [], failed: [] };
    for (const id of accountIds) {
        try {
            const normalized = normalizeAccountId(id);
            result.success.push(normalized);
        }
        catch (e) {
            result.failed.push({ input: id, error: e.message });
        }
    }
    return result;
}
function batchFilterByType(accountIds, type) {
    const result = { success: [], failed: [] };
    for (const id of accountIds) {
        if (!isValidAccountId(id)) {
            result.failed.push({ input: id, error: 'Invalid account ID' });
            continue;
        }
        const isImplicit = isImplicitAccount(id);
        if ((type === 'implicit' && isImplicit) || (type === 'named' && !isImplicit)) {
            result.success.push(id);
        }
    }
    return result;
}
function isFullAccessKey(permission) {
    return permission === 'FullAccess';
}
function isFunctionCallKey(permission) {
    return typeof permission === 'object' && 'FunctionCall' in permission;
}
function formatAccessKeyPermission(permission) {
    if (permission === 'FullAccess')
        return 'Full Access';
    if (typeof permission === 'object' && 'FunctionCall' in permission) {
        const fc = permission.FunctionCall;
        return `Function Call: ${fc.receiverId} (${fc.methodNames.length} methods)`;
    }
    return 'Unknown';
}
// Account comparison
function accountsEqual(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}
// Sort accounts alphabetically
function sortAccounts(accountIds) {
    return [...accountIds].sort((a, b) => a.localeCompare(b));
}
// Filter accounts by TLD
function filterByTLD(accountIds, tld) {
    return accountIds.filter(id => getTLD(id) === tld.toLowerCase());
}
// Get account depth (number of dots + 1)
function getAccountDepth(accountId) {
    if (!isValidAccountId(accountId))
        return 0;
    return accountId.split('.').length;
}
// Check if account is a sub-account (has at least one parent)
function isSubAccount(accountId) {
    if (!isValidAccountId(accountId))
        return false;
    const parts = accountId.split('.');
    return parts.length > 2; // e.g. sub.alice.near = 3 parts
}
// Re-export everything
exports.default = {
    isValidAccountId,
    isImplicitAccount,
    isNamedAccount,
    formatAccountId,
    getTLD,
    getParentAccount,
    getSubAccountName,
    normalizeAccountId,
    publicKeyToImplicitAccount,
    batchValidateAccounts,
    batchFilterByType,
    isFullAccessKey,
    isFunctionCallKey,
    formatAccessKeyPermission,
    accountsEqual,
    sortAccounts,
    filterByTLD,
    getAccountDepth,
    isSubAccount,
};
//# sourceMappingURL=index.js.map