import { encodeFunctionData, erc20Abi } from 'viem'
import { checkedCurrencyCall } from '../currency-operation'
import { EURC_ASSET } from '@/constants/currency-accounts.consts'
import type { CurrencyOperation } from '@/services/currency-accounts'

const recipient = `0x${'22'.repeat(20)}` as `0x${string}`
const operation: CurrencyOperation = {
    id: 'validation',
    kind: 'SEND',
    sourceAsset: 'EURC',
    amount: '1.000001',
    status: 'READY',
    userOpHash: null,
    txHash: null,
    errorCode: null,
    bankInstructions: null,
    call: {
        chainId: '8453',
        to: EURC_ASSET.tokenAddress,
        value: '0',
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [recipient, 1000001n] }),
    },
}

it('returns the exact validated transfer call and destination', () => {
    expect(checkedCurrencyCall(operation)).toEqual({ ...operation.call, value: 0n, recipient })
})

it.each([
    { chainId: '42161' },
    { to: recipient },
    { value: '1' },
    { data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [recipient, 1000001n] }) },
])('rejects a substituted call before signing: %j', (change) => {
    expect(() => checkedCurrencyCall({ ...operation, call: { ...operation.call!, ...change } })).toThrow(/Currency/)
})

it('rejects mismatched amounts and missing calls', () => {
    expect(() => checkedCurrencyCall({ ...operation, amount: '2' })).toThrow('Currency amount mismatch')
    expect(() => checkedCurrencyCall({ ...operation, call: null })).toThrow('Currency call mismatch')
})
