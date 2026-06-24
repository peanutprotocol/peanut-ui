import { BALANCE_SETTLING_MESSAGE } from '@/utils/balance.utils'

/** Safely extract a string-form of an unknown error + its `.message` if any.
 *  Lets the matchers below use `string` methods without unsafe property access
 *  while still accepting whatever shape callers throw (Error, string, object). */
function extractErrorParts(error: unknown): { text: string; message: string | undefined } {
    if (typeof error === 'string') return { text: error, message: error }
    if (error && typeof error === 'object') {
        const obj = error as { toString?: () => unknown; message?: unknown }
        const rawText = typeof obj.toString === 'function' ? obj.toString() : ''
        const text = typeof rawText === 'string' ? rawText : ''
        const message = typeof obj.message === 'string' ? obj.message : undefined
        return { text, message }
    }
    return { text: '', message: undefined }
}

/**
 * Returns the verbatim error message when it's an actionable Rain card-
 * collateral error from the backend (`/rain/cards/withdraw/prepare`):
 * - 425/409: "A previous withdrawal is still active for this card. Try
 *   again in about M min." (+ legacy TooEarlyError variant)
 * - 422: "Insufficient collateral balance for this withdrawal"
 *
 * Returns null for anything else so callers fall through to their own copy.
 * Use this in any callsite that does its own catch on a Rain-touching spend
 * (signSpend / spend / sendMoney / sendTransactions(requiredUsdcAmount)).
 */
export const rainCollateralErrorMessage = (error: unknown): string | null => {
    const { text, message } = extractErrorParts(error)
    if (
        text.includes('A previous withdrawal is still active for this card') ||
        text.includes('A previous withdrawal signature is still active') ||
        text.includes('Insufficient collateral balance for this withdrawal')
    ) {
        return message ?? text
    }
    return null
}

/** UI-friendly error message extractor. Matches substrings on common
 *  wallet / viem / Peanut API error messages and returns user-facing copy. */
export const ErrorHandler = (error: unknown): string => {
    const { text, message } = extractErrorParts(error)
    // Rain card-collateral errors — surface the backend's already user-
    // friendly copy verbatim (includes the "Try again in about M min." hint
    // on the cooldown case). Covers every spend path that touches Rain.
    const rainMsg = rainCollateralErrorMessage(error)
    if (rainMsg) return rainMsg
    // Spend passed the displayed-balance gate but couldn't be routed yet
    // (in-transit collateral not landed) — nudge a retry rather than "add funds".
    if (text.includes('Insufficient spendable balance')) return BALANCE_SETTLING_MESSAGE
    if (text.includes('insufficient funds')) return "You don't have enough funds."
    if (text.includes('user rejected transaction')) return 'Please confirm the transaction in your wallet.'
    if (text.includes('not deployed on chain')) return 'Bulk is not able on this chain, please try another chain.'
    if (text.includes('User rejected the request')) return 'Please confirm the request in your wallet.'
    if (text.includes('NETWORK_ERROR')) return 'A network error occured. Please refresh and try again.'
    if (text.includes('NONCE_EXPIRED')) return 'Nonce expired, please try again.'
    if (text.includes('Failed to get wallet client')) return 'Please make sure your wallet is connected.'
    if (text.includes('gas required exceeds allowance'))
        return 'Gas required exceeds balance. Please confirm you have enough funds.'
    if (
        text.includes('fee cap (`maxFeePerGas`)') ||
        text.includes('max fee per gas less than block base fee') ||
        text.includes('EstimateGasExecutionError')
    ) {
        return 'Transaction failed, please make sure you have enough native token on this network to cover gas fees.'
    }
    if (
        text.includes(
            'Something went wrong while fetching the token price. Please change the input denomination and try again'
        )
    )
        return 'Something went wrong while fetching the token price. Please change the input denomination and try again.'
    if (text.includes('Please ensure that the correct token and chain are defined'))
        return 'Please ensure that the correct token and chain are defined.'
    if (text.includes('Please ensure that you have sufficient balance of the token you are trying to send'))
        return 'Please ensure that you have sufficient balance of the token you are trying to send, including gas fees.'
    if (text.includes('The minimum amount to send is 0.0001')) return 'The minimum amount to send is 0.0001.'
    if (text.includes('Error getting the linkDetails')) return 'Error getting the linkDetails.'
    if (text.includes('Error generating the password.')) return 'Error generating the password.'
    if (text.includes('Error making the gasless deposit payload.')) return 'Error making the gasless deposit payload.'
    if (text.includes('Error preparing the transaction(s).')) return 'Error preparing the transaction(s).'
    if (text.includes('Error switching network.')) return 'Error switching network.'
    if (text.includes('Error signing the data in the wallet.')) return 'Error signing the data in the wallet.'
    if (text.includes('Error making the gasless deposit through the peanut api.'))
        return 'Error making the gasless deposit through the peanut api.'
    if (text.includes('Error sending the transaction.')) return 'Error sending the transaction.'
    if (text.includes('Error getting the link with transactionHash')) return message ?? text
    if (text.includes('transfer amount exceeds balance'))
        return 'You do not have enough balance to complete the transaction.'
    if (text.includes('does not match the target chain for the transaction'))
        return 'Failed to switch network. Try switching to the correct network manually.'
    if (text.includes('Insufficient balance')) return "You don't have enough balance."
    if (text.includes('The operation either timed out or was not allowed')) return 'Please confirm the transaction.'
    // iOS Safari's NotAllowedError copy when the passkey ceremony never
    // completes. Third-party credential providers (1Password) can wedge and
    // refuse every assertion until unlocked or the device restarts
    // (TASK-20000) — retrying after that works, so don't dead-end on the
    // generic "contact support" fallback. Matched on message text rather
    // than error.name: NotAllowedError is also thrown by camera/clipboard
    // APIs (the QR scanner raises one), and wrapped signing errors keep the
    // text but lose the name.
    if (text.includes('not allowed by the user agent'))
        return "Your device didn't complete the passkey confirmation. Try again — if it keeps failing, unlock your password manager (e.g. 1Password) or restart your device."
    if (text.includes('Wrong password or invalid transaction.') || text.includes('transaction may fail'))
        return 'Could not claim link, please refresh page. If problem persist confirm link with sender'
    if (text.includes('Send link already claimed')) return 'Send link already claimed'
    if (text.toLowerCase().includes('liquidity'))
        return message || 'Low liquidity. Please try a smaller amount or different route.'
    // viem transport timeout — most often a slow ZeroDev paymaster/bundler RPC
    // (`zd_sponsorUserOperation`) on a busy network. Transient + retryable, so
    // tell the user to try again instead of the generic "contact support".
    // `timed out after` also covers our own `fetchWithSentry` AbortError copy
    // ("Request to <url> timed out after <ms>ms") — without it, every server
    // fetch timeout fell through to the generic "contact support" fallback
    // (Sentry PEANUT-UI-QH9, Bridge offramp /confirm). Callers that move money
    // must still gate Retry separately — see WithdrawBankPage.
    if (
        text.includes('took too long to respond') ||
        text.includes('The request timed out') ||
        text.includes('timed out after')
    )
        return 'The network is busy and your request timed out. Please try again in a moment.'
    return 'There was an issue with your request. Please contact support.'
}
