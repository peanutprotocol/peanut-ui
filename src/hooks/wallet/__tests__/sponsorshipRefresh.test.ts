import { toSponsorshipRefresh } from '../sponsorshipRefresh'

const operation = { chainId: '42161', maxFeePerGas: 0n, maxPriorityFeePerGas: 0n }
const gasOnly = {
    callGasLimit: 2n,
    verificationGasLimit: 3n,
    preVerificationGas: 4n,
    paymasterVerificationGasLimit: 0n,
    paymasterPostOpGasLimit: 0n,
    paymaster: undefined,
    paymasterData: undefined,
}

test('accepts an UltraRelay gas-only response and explicitly clears all old paymaster fields', () => {
    expect(toSponsorshipRefresh(gasOnly, operation)).toEqual({
        ...gasOnly,
        paymasterVerificationGasLimit: undefined,
        paymasterPostOpGasLimit: undefined,
    })
})

test('uses the refreshed fees when deciding whether the final operation is zero-fee', () => {
    expect(
        toSponsorshipRefresh(
            { ...gasOnly, maxFeePerGas: 0n, maxPriorityFeePerGas: 0n },
            { ...operation, maxFeePerGas: 1n, maxPriorityFeePerGas: 1n }
        )
    ).toMatchObject({ maxFeePerGas: 0n, maxPriorityFeePerGas: 0n })
})

test.each([
    ['nonzero fee', { ...gasOnly, maxFeePerGas: 1n }, operation],
    ['nonzero priority fee', { ...gasOnly, maxPriorityFeePerGas: 1n }, operation],
    ['inherited nonzero fee', gasOnly, { ...operation, maxFeePerGas: 1n }],
    ['inherited nonzero priority fee', gasOnly, { ...operation, maxPriorityFeePerGas: 1n }],
    ['unknown fees', gasOnly, { chainId: '42161' }],
    ['another chain', gasOnly, { ...operation, chainId: '8453' }],
    ['testnet', gasOnly, { ...operation, chainId: '421614' }],
    ['nonzero paymaster verification gas', { ...gasOnly, paymasterVerificationGasLimit: 1n }, operation],
    ['nonzero paymaster post-op gas', { ...gasOnly, paymasterPostOpGasLimit: 1n }, operation],
    ['missing gas', { ...gasOnly, preVerificationGas: undefined }, operation],
    ['numeric gas', { ...gasOnly, callGasLimit: 2 }, operation],
    ['negative gas', { ...gasOnly, verificationGasLimit: -1n }, operation],
    ['negative fee', { ...gasOnly, maxFeePerGas: -1n }, operation],
    ['partial paymaster data', { ...gasOnly, paymasterData: '0xf00d' }, operation],
    ['partial paymaster address', { ...gasOnly, paymaster: '0x0000000000000000000000000000000000000001' }, operation],
    ['null paymaster', { ...gasOnly, paymaster: null }, operation],
    ['null paymaster data', { ...gasOnly, paymasterData: null }, operation],
])('rejects a gas-only or malformed response with %s', (_label, response, input) => {
    expect(toSponsorshipRefresh(response, input)).toBeNull()
})

test('keeps conventional sponsorship, including on other chains with positive fees', () => {
    const response = {
        ...gasOnly,
        paymaster: '0x0000000000000000000000000000000000000001',
        paymasterData: '0xf00d',
        paymasterVerificationGasLimit: 5n,
        paymasterPostOpGasLimit: 6n,
        maxFeePerGas: 7n,
        maxPriorityFeePerGas: 8n,
    }
    expect(toSponsorshipRefresh(response, { chainId: '8453' })).toEqual(response)
})
