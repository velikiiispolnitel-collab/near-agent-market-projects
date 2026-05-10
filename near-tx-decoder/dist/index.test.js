"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
describe('decodeAction', () => {
    test('decodes Transfer', () => {
        const result = (0, index_1.decodeAction)({
            type: 'Transfer',
            params: { deposit: '1000000000000000000000000', receiverId: 'bob.near' },
        });
        expect(result.type).toBe('Transfer');
        expect(result.description).toContain('1.0000 NEAR');
        expect(result.description).toContain('bob.near');
    });
    test('decodes CreateAccount', () => {
        const result = (0, index_1.decodeAction)({ type: 'CreateAccount', params: {} });
        expect(result.type).toBe('CreateAccount');
        expect(result.description).toContain('Creates');
    });
    test('decodes DeployContract', () => {
        const result = (0, index_1.decodeAction)({
            type: 'DeployContract',
            params: { accountId: 'contract.near' },
        });
        expect(result.type).toBe('DeployContract');
        expect(result.description).toContain('Deploys');
    });
    test('decodes FunctionCall', () => {
        const result = (0, index_1.decodeAction)({
            type: 'FunctionCall',
            params: {
                methodName: 'transfer',
                args: Buffer.from(JSON.stringify({ amount: '100' })).toString('base64'),
                receiverId: 'app.near',
                gas: '30000000000000',
                deposit: '0',
            },
        });
        expect(result.type).toBe('FunctionCall');
        expect(result.description).toContain('transfer()');
        expect(result.description).toContain('app.near');
    });
    test('decodes Stake', () => {
        const result = (0, index_1.decodeAction)({
            type: 'Stake',
            params: { stake: '5000000000000000000000000', publicKey: 'ed25519:abc' },
        });
        expect(result.type).toBe('Stake');
        expect(result.description).toContain('5.0000 NEAR');
    });
    test('decodes AddKey', () => {
        const result = (0, index_1.decodeAction)({
            type: 'AddKey',
            params: { accessKey: { permission: 'FullAccess' } },
        });
        expect(result.type).toBe('AddKey');
        expect(result.description).toContain('Adds');
    });
    test('decodes DeleteKey', () => {
        const result = (0, index_1.decodeAction)({
            type: 'DeleteKey',
            params: { publicKey: 'ed25519:abc' },
        });
        expect(result.type).toBe('DeleteKey');
        expect(result.description).toContain('Removes');
    });
    test('decodes DeleteAccount', () => {
        const result = (0, index_1.decodeAction)({
            type: 'DeleteAccount',
            params: { beneficiaryId: 'bob.near' },
        });
        expect(result.type).toBe('DeleteAccount');
        expect(result.description).toContain('bob.near');
    });
    test('handles unknown action type', () => {
        const result = (0, index_1.decodeAction)({ type: 'UnknownAction', params: {} });
        expect(result.type).toBe('UnknownAction');
        expect(result.description).toContain('Unknown');
    });
});
describe('decodeTransaction', () => {
    test('decodes full transaction', () => {
        const tx = (0, index_1.decodeTransaction)({
            signerId: 'alice.near',
            receiverId: 'bob.near',
            actions: [
                { type: 'Transfer', params: { deposit: '1000000000000000000000000' } },
                { type: 'CreateAccount', params: {} },
            ],
        });
        expect(tx.signerId).toBe('alice.near');
        expect(tx.receiverId).toBe('bob.near');
        expect(tx.actions).toHaveLength(2);
        expect(tx.summary).toContain('Transfer');
        expect(tx.summary).toContain('Creates a new NEAR account');
    });
    test('handles empty actions', () => {
        const tx = (0, index_1.decodeTransaction)({
            signerId: 'alice.near',
            receiverId: 'bob.near',
            actions: [],
        });
        expect(tx.actions).toHaveLength(0);
        expect(tx.summary).toBe('');
    });
});
describe('formatNearAmount', () => {
    test('formats whole NEAR', () => {
        expect((0, index_1.formatNearAmount)('1000000000000000000000000')).toBe('1.0000 NEAR');
        expect((0, index_1.formatNearAmount)('5000000000000000000000000')).toBe('5.0000 NEAR');
    });
    test('formats thousands', () => {
        const result = (0, index_1.formatNearAmount)('1000000000000000000000000000');
        expect(result).toContain('K NEAR');
    });
    test('formats small amounts', () => {
        const result = (0, index_1.formatNearAmount)('1000000000000000000000');
        expect(result).toContain('mNEAR');
    });
    test('formats raw yocto', () => {
        const result = (0, index_1.formatNearAmount)('1');
        expect(result).toContain('yoctoNEAR');
    });
});
describe('formatPermission', () => {
    test('formats FullAccess', () => {
        expect((0, index_1.formatPermission)('FullAccess')).toBe('Full Access');
    });
    test('formats FunctionCall', () => {
        const result = (0, index_1.formatPermission)({
            FunctionCall: { receiverId: 'app.near', methodNames: ['transfer', 'approve'] },
        });
        expect(result).toContain('Function Call');
        expect(result).toContain('app.near');
        expect(result).toContain('2');
    });
    test('handles unknown', () => {
        expect((0, index_1.formatPermission)({})).toBe('Unknown');
    });
});
describe('summarizeTransaction', () => {
    test('generates summary', () => {
        const summary = (0, index_1.summarizeTransaction)({
            signerId: 'alice.near',
            receiverId: 'bob.near',
            actions: [
                { type: 'Transfer', description: 'Transfers 1 NEAR', details: {} },
            ],
            summary: '',
        });
        expect(summary).toContain('alice.near → bob.near');
        expect(summary).toContain('Transfers 1 NEAR');
    });
});
describe('ABI registry', () => {
    test('lookups known method', () => {
        expect((0, index_1.lookupMethod)('v2.ref-finance.near', 'swap')).toBe('Swap tokens on Ref Finance');
        expect((0, index_1.lookupMethod)('wrap.near', 'near_deposit')).toBe('Wrap NEAR to wNEAR');
    });
    test('returns null for unknown', () => {
        expect((0, index_1.lookupMethod)('unknown.near', 'method')).toBeNull();
    });
    test('registers custom ABI', () => {
        (0, index_1.registerABI)('custom.near', {
            methods: {
                myMethod: { description: 'My custom method' },
            },
        });
        expect((0, index_1.lookupMethod)('custom.near', 'myMethod')).toBe('My custom method');
    });
});
