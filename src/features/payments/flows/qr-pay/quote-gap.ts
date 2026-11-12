import { formatUnits, parseUnits } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/wallet-token.consts'
import { parseUsdAmountToUnits } from '@/utils/balance.utils'
import { formatAmountNumber } from '@/utils/currency'

/** The form takes the local amount to the cent (the AmountInput in QrPayFormView). */
const LOCAL_AMOUNT_DECIMALS = 2

/**
 * The largest local amount an open-amount QR can pay from `availableUsdc`, or
 * null when the shortfall is not a quote gap (TASK-24621).
 *
 * Why the lock can ask more than the balance the form approved: the form
 * converts the typed local amount at the rate it read on scan and floors the
 * USD to the cent, and the lock minted at Pay prices the same local amount at
 * the provider's rate of that moment. Two BRL locks up to five minutes apart
 * differed by up to 0.33% (p99, 30 days to 2026-11-12), so a whole-balance
 * amount can come out a few cents to a few dollars above the balance.
 *
 * A quote gap means the balance still covers the USD the form showed and only
 * the lock asks more: nothing is in transit, so waiting cannot help. Scaling
 * the local amount by available / locked fits it at the lock's rate. A balance
 * below what the form showed means money moved under the screen (a card top-up
 * or a deposit still landing), and that stays the settling case.
 */
export function largestLocalAmountWithinBalance(input: {
    /** The local amount the lock was minted for. */
    localAmount: string
    /** The USD the form showed for it, which the balance gate approved. */
    shownUsd: string | undefined
    lockedUsdc: bigint
    availableUsdc: bigint
}): string | null {
    const shownUsdc = parseUsdAmountToUnits(input.shownUsd ?? '')
    if (shownUsdc === null || input.availableUsdc < shownUsdc) return null
    const localUnits = parseUnits(input.localAmount, LOCAL_AMOUNT_DECIMALS)
    // Floored: a cent more could already ask more than the balance holds.
    const fitted = (localUnits * input.availableUsdc) / input.lockedUsdc
    return fitted > 0n ? formatUnits(fitted, LOCAL_AMOUNT_DECIMALS) : null
}

/**
 * How much USD `balanceUsdc` lacks for `requiredUsdc`, rounded UP to the cent:
 * adding that much is always enough, and a sub-cent gap never reads "$0".
 */
export function usdShortfall(requiredUsdc: bigint, balanceUsdc: bigint): string {
    const unitsPerCent = 10n ** BigInt(PEANUT_WALLET_TOKEN_DECIMALS - 2)
    const cents = (requiredUsdc - balanceUsdc + unitsPerCent - 1n) / unitsPerCent
    return formatAmountNumber(formatUnits(cents, 2))
}
