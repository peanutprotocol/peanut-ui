import { decodeFunctionData, erc20Abi, parseUnits } from 'viem'
import type { CurrencyOperation } from '@/services/currency-accounts'
import { EURC_ASSET } from '@/constants/currency-accounts.consts'

export const isFinalCurrencyOperation = (status: string) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)

export function checkedCurrencyCall(operation: CurrencyOperation) {
    const call = operation.call
    const asset =
        operation.sourceAsset === 'EURC'
            ? EURC_ASSET
            : { chainId: '42161', tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' }
    if (
        !call ||
        call.chainId !== asset.chainId ||
        call.to.toLowerCase() !== asset.tokenAddress ||
        BigInt(call.value) !== 0n
    )
        throw new Error('Currency call mismatch')
    const decoded = decodeFunctionData({ abi: erc20Abi, data: call.data })
    if (decoded.functionName !== 'transfer' || decoded.args[1] !== parseUnits(operation.amount, 6))
        throw new Error('Currency amount mismatch')
    return { ...call, value: 0n, recipient: decoded.args[0] }
}
