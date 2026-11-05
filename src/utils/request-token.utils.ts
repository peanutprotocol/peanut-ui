import { REQUEST_TOKEN_SYMBOLS } from '@/constants/general.consts'
import type { TRequestChargeResponse } from '@/services/services.types'

/** Whether a payment request can be paid in this token: USDC or USDT only (TASK-23850). */
export function isRequestToken(tokenSymbol: string | undefined): boolean {
    return !!tokenSymbol && REQUEST_TOKEN_SYMBOLS.includes(tokenSymbol.toUpperCase())
}

/**
 * An unpaid charge in a token requests no longer take (an ETH request made
 * before TASK-23850). It can't be paid anymore, so it never reaches Confirm.
 * A paid one keeps its receipt.
 */
export function isUnpayableRequestCharge(
    charge: Pick<TRequestChargeResponse, 'tokenSymbol' | 'fulfillmentPayment'>
): boolean {
    return !isRequestToken(charge.tokenSymbol) && charge.fulfillmentPayment?.status !== 'SUCCESSFUL'
}
