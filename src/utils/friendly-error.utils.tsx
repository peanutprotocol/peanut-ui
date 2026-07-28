/** Safely extract a string-form of an unknown error + its `.message` if any.
 *  Lets the matchers below use `string` methods without unsafe property access
 *  while still accepting whatever shape callers throw (Error, string, object). */
function extractErrorParts(error: unknown): { text: string; message: string | undefined; name: string | undefined } {
    if (typeof error === 'string') return { text: error, message: error, name: undefined }
    if (error && typeof error === 'object') {
        const obj = error as { toString?: () => unknown; message?: unknown; name?: unknown }
        const rawText = typeof obj.toString === 'function' ? obj.toString() : ''
        const text = typeof rawText === 'string' ? rawText : ''
        const message = typeof obj.message === 'string' ? obj.message : undefined
        const name = typeof obj.name === 'string' ? obj.name : undefined
        return { text, message, name }
    }
    return { text: '', message: undefined, name: undefined }
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
    const { text, message, name } = extractErrorParts(error)
    // Stale card approval (409 STALE_CARD_APPROVAL) — the global re-enable modal
    // owns the recovery CTA, but the flow that threw still shows an inline error.
    // Surface the backend's friendly re-enable copy here so the inline path
    // matches the modal instead of dead-ending on "contact support".
    if (name === 'StaleCardApprovalError') return message ?? text
    if (
        text.includes('A previous withdrawal is still active for this card') ||
        text.includes('A previous withdrawal signature is still active') ||
        text.includes('Insufficient collateral balance for this withdrawal')
    ) {
        return message ?? text
    }
    return null
}

/** Display code for a mapped user-facing error. Callers turn it into copy via
 *  the `errors` next-intl namespace (see `useFriendlyError`). This module stays
 *  copy-free — it only classifies. */
export type FriendlyErrorCode =
    | 'balanceSettling'
    | 'insufficientFunds'
    | 'userRejectedTransaction'
    | 'notDeployedOnChain'
    | 'userRejectedRequest'
    | 'networkError'
    | 'nonceExpired'
    | 'walletNotConnected'
    | 'gasExceedsAllowance'
    | 'gasFeesNativeToken'
    | 'tokenPriceFetch'
    | 'tokenChainUndefined'
    | 'insufficientTokenBalance'
    | 'minimumSendAmount'
    | 'linkDetailsError'
    | 'passwordGenerationError'
    | 'gaslessDepositPayloadError'
    | 'prepareTransactionError'
    | 'switchNetworkError'
    | 'signDataError'
    | 'gaslessDepositApiError'
    | 'sendTransactionError'
    | 'transferAmountExceedsBalance'
    | 'chainMismatch'
    | 'insufficientBalance'
    | 'operationTimedOut'
    | 'passkeyNotCompleted'
    | 'claimLinkFailed'
    | 'sendLinkAlreadyClaimed'
    | 'lowLiquidity'
    | 'networkBusyTimeout'
    | 'genericSupport'

/**
 * A classified error. `kind: 'code'` maps to localized copy; `kind: 'text'`
 * is backend-authored copy (Rain re-enable hint, viem liquidity detail, the
 * `transactionHash` fetch message) that MUST pass through untranslated — there
 * is no key for server-generated / dynamic text.
 */
export type FriendlyError = { kind: 'code'; code: FriendlyErrorCode } | { kind: 'text'; text: string }

const code = (c: FriendlyErrorCode): FriendlyError => ({ kind: 'code', code: c })
const passthrough = (text: string): FriendlyError => ({ kind: 'text', text })

/** UI-friendly error classifier. Matches substrings on common wallet / viem /
 *  Peanut API error messages and returns a display code (or verbatim backend
 *  text). Preserves the exact precedence of the original `ErrorHandler`. */
export const friendlyError = (error: unknown): FriendlyError => {
    const { text, message, name } = extractErrorParts(error)
    // Rain card-collateral errors — surface the backend's already user-
    // friendly copy verbatim (includes the "Try again in about M min." hint
    // on the cooldown case). Covers every spend path that touches Rain.
    const rainMsg = rainCollateralErrorMessage(error)
    if (rainMsg) return passthrough(rainMsg)
    // Spend passed the displayed-balance gate but couldn't be routed yet
    // (in-transit collateral not landed) — nudge a retry rather than "add funds".
    // Match the typed error's name first (stable) and fall back to the message.
    if (name === 'InsufficientSpendableError' || text.includes('Insufficient spendable balance'))
        return code('balanceSettling')
    if (text.includes('insufficient funds')) return code('insufficientFunds')
    if (text.includes('user rejected transaction')) return code('userRejectedTransaction')
    if (text.includes('not deployed on chain')) return code('notDeployedOnChain')
    if (text.includes('User rejected the request')) return code('userRejectedRequest')
    if (text.includes('NETWORK_ERROR')) return code('networkError')
    if (text.includes('NONCE_EXPIRED')) return code('nonceExpired')
    if (text.includes('Failed to get wallet client')) return code('walletNotConnected')
    if (text.includes('gas required exceeds allowance')) return code('gasExceedsAllowance')
    if (
        text.includes('fee cap (`maxFeePerGas`)') ||
        text.includes('max fee per gas less than block base fee') ||
        text.includes('EstimateGasExecutionError')
    ) {
        return code('gasFeesNativeToken')
    }
    if (
        text.includes(
            'Something went wrong while fetching the token price. Please change the input denomination and try again'
        )
    )
        return code('tokenPriceFetch')
    if (text.includes('Please ensure that the correct token and chain are defined')) return code('tokenChainUndefined')
    if (text.includes('Please ensure that you have sufficient balance of the token you are trying to send'))
        return code('insufficientTokenBalance')
    if (text.includes('The minimum amount to send is 0.0001')) return code('minimumSendAmount')
    if (text.includes('Error getting the linkDetails')) return code('linkDetailsError')
    if (text.includes('Error generating the password.')) return code('passwordGenerationError')
    if (text.includes('Error making the gasless deposit payload.')) return code('gaslessDepositPayloadError')
    if (text.includes('Error preparing the transaction(s).')) return code('prepareTransactionError')
    if (text.includes('Error switching network.')) return code('switchNetworkError')
    if (text.includes('Error signing the data in the wallet.')) return code('signDataError')
    if (text.includes('Error making the gasless deposit through the peanut api.')) return code('gaslessDepositApiError')
    if (text.includes('Error sending the transaction.')) return code('sendTransactionError')
    if (text.includes('Error getting the link with transactionHash')) return passthrough(message ?? text)
    if (text.includes('transfer amount exceeds balance')) return code('transferAmountExceedsBalance')
    if (text.includes('does not match the target chain for the transaction')) return code('chainMismatch')
    if (text.includes('Insufficient balance')) return code('insufficientBalance')
    if (text.includes('The operation either timed out or was not allowed')) return code('operationTimedOut')
    // iOS Safari's NotAllowedError copy when the passkey ceremony never
    // completes. Third-party credential providers (1Password) can wedge and
    // refuse every assertion until unlocked or the device restarts
    // (TASK-20000) — retrying after that works, so don't dead-end on the
    // generic "contact support" fallback. Matched on message text rather
    // than error.name: NotAllowedError is also thrown by camera/clipboard
    // APIs (the QR scanner raises one), and wrapped signing errors keep the
    // text but lose the name.
    if (text.includes('not allowed by the user agent')) return code('passkeyNotCompleted')
    if (text.includes('Wrong password or invalid transaction.') || text.includes('transaction may fail'))
        return code('claimLinkFailed')
    if (text.includes('Send link already claimed')) return code('sendLinkAlreadyClaimed')
    // Liquidity errors carry a backend-authored detail when present — pass it
    // through verbatim; only fall back to the coded copy when there's no message.
    if (text.toLowerCase().includes('liquidity')) return message ? passthrough(message) : code('lowLiquidity')
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
        return code('networkBusyTimeout')
    return code('genericSupport')
}
