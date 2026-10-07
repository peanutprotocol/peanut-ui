const { execFileSync } = require('child_process')
const path = require('path')

test('the installed ZeroDev SDK sends valid preview sponsorship metadata', () => {
    // A child process bypasses Jest's SDK mock: validate the real serializer,
    // with only its network request replaced. No provider credentials needed.
    const root = path.join(__dirname, '..', '..')
    execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type',
            'module',
            '--eval',
            `
        import assert from 'node:assert/strict';
        import { createRequire } from 'node:module';
        const require = createRequire(import.meta.url);
        const { sponsorUserOperation } = require('@zerodev/sdk/actions');
        const { entryPoint07Address } = require('viem/account-abstraction');
        const { sponsorUserOperationArgs, PAYMASTER_PREVIEW_CONTEXT } =
            require('./src/hooks/wallet/paymasterSponsorship.ts');
        let wire;
        await sponsorUserOperation({ chain: { id: 42161 }, request: async (payload) => {
            wire = payload;
            return { callGasLimit: '0x1', verificationGasLimit: '0x2', preVerificationGas: '0x3',
                paymasterVerificationGasLimit: '0x4', paymasterPostOpGasLimit: '0x5',
                paymaster: '0x0000000000000000000000000000000000000001', paymasterData: '0x' };
        } }, sponsorUserOperationArgs({ sender: '0x0000000000000000000000000000000000000001',
            nonce: 1n, callData: '0x', entryPointAddress: entryPoint07Address,
            context: PAYMASTER_PREVIEW_CONTEXT, paymasterContext: PAYMASTER_PREVIEW_CONTEXT,
            parameters: ['paymaster'] }));
        assert.equal(wire.method, 'zd_sponsorUserOperation');
        assert.equal(wire.params[0].shouldConsume, false);
        assert.equal(wire.params[0].userOp.nonce, '0x1');
        for (const key of ['paymasterContext', 'parameters', 'context'])
            assert.equal(key in wire.params[0].userOp, false);
    `,
        ],
        { cwd: root, stdio: 'pipe' }
    )
})
