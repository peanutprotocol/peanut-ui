import { friendlyError, rainCollateralErrorMessage, type FriendlyErrorCode } from '../friendly-error.utils'
import en from '@/i18n/app/messages/en.json'

describe('friendlyError', () => {
    describe('viem transport timeout (ZeroDev paymaster/bundler)', () => {
        // Verbatim shape of the error that silently broke crypto withdrawals
        // (prod user andrevalen, 2026-05-30): viem's TimeoutError on
        // zd_sponsorUserOperation. Previously fell through to the generic
        // "contact support" fallback, masking a transient + retryable failure.
        const timeoutError = Object.assign(
            new Error(
                'The request took too long to respond.\n\nURL: https://rpc.zerodev.app/api/v3/key/chain/42161\nRequest body: {"method":"zd_sponsorUserOperation"}'
            ),
            { name: 'TimeoutError' }
        )

        test('maps the verbatim ZeroDev sponsor timeout to the retryable code', () => {
            expect(friendlyError(timeoutError)).toEqual({ kind: 'code', code: 'networkBusyTimeout' })
        })

        test('matches a bare "The request timed out" message', () => {
            expect(friendlyError(new Error('The request timed out.'))).toEqual({
                kind: 'code',
                code: 'networkBusyTimeout',
            })
        })

        test('maps fetchWithSentry AbortError copy ("timed out after <ms>ms")', () => {
            // Verbatim shape from sentry.utils.ts AbortError path. The Bridge
            // offramp `/confirm` 10s timeout (Konrad, 2026-06-01, PEANUT-UI-QH9)
            // would otherwise fall through to the generic "contact support"
            // code and surface a Retry button next to an on-chain leg that
            // already fired — risking a double-pay.
            const fetchTimeoutError = new Error(
                'Request to https://api.peanut.me/bridge/transfers/01e7a858-a849-4daa-9df7-e680d47bcfc1/confirm timed out after 10000ms'
            )
            expect(friendlyError(fetchTimeoutError)).toEqual({ kind: 'code', code: 'networkBusyTimeout' })
        })

        test('does NOT hijack the WebAuthn "operation either timed out" message', () => {
            // Ordering guard: the passkey-prompt timeout has its own code and is
            // matched earlier; the generic timeout matcher must not swallow it.
            expect(friendlyError(new Error('The operation either timed out or was not allowed'))).toEqual({
                kind: 'code',
                code: 'operationTimedOut',
            })
        })
    })

    describe('WebAuthn NotAllowedError (passkey ceremony refused)', () => {
        test('maps the verbatim iOS Safari message to the passkey code', () => {
            // Verbatim DOMException message from prod (user ariel, 2026-06-06,
            // TASK-20000): 1Password as iOS credential provider wedged and
            // refused every signing assertion. Previously fell through to the
            // generic "contact support" fallback even though a retry after
            // unlocking the provider (or rebooting) succeeds.
            const webAuthnRefused = Object.assign(
                new Error(
                    'The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.'
                ),
                { name: 'NotAllowedError' }
            )
            expect(friendlyError(webAuthnRefused)).toEqual({ kind: 'code', code: 'passkeyNotCompleted' })
        })
    })

    test('unknown errors still fall through to the support-fallback code', () => {
        expect(friendlyError(new Error('something nobody mapped'))).toEqual({ kind: 'code', code: 'genericSupport' })
    })

    test('the settling failure returns the retryable balance code', () => {
        const settling = Object.assign(new Error('Insufficient spendable balance'), {
            name: 'InsufficientSpendableError',
        })
        expect(friendlyError(settling)).toEqual({ kind: 'code', code: 'balanceSettling' })
    })

    // Pre-contract fallback: these fixtures carry no wire `code`, which is
    // exactly the shape an API that predates the error-code contract returns.
    test('rain collateral errors WITHOUT a wire code still pass backend text through verbatim', () => {
        const cooldown = new Error('A previous withdrawal is still active for this card. Try again in about 2 min.')
        expect(rainCollateralErrorMessage(cooldown)).toBe(cooldown.message)
        expect(friendlyError(cooldown)).toEqual({ kind: 'text', text: cooldown.message })
    })

    test('stale-card-approval without a wire code still passes its backend copy through', () => {
        // Matched by error name so the inline path matches the global re-enable
        // modal instead of dead-ending on the generic support fallback.
        const stale = new Error('Your card needs to be re-enabled before you can withdraw.')
        stale.name = 'StaleCardApprovalError'
        expect(rainCollateralErrorMessage(stale)).toBe(stale.message)
        expect(friendlyError(stale)).toEqual({ kind: 'text', text: stale.message })
    })

    test('liquidity errors pass the backend detail through, or fall back to the coded copy', () => {
        expect(friendlyError(new Error('Low liquidity on this route'))).toEqual({
            kind: 'text',
            text: 'Low liquidity on this route',
        })
        // No `.message` (bare object whose toString carries the match) → coded copy.
        expect(friendlyError({ toString: () => 'insufficient liquidity' })).toEqual({
            kind: 'code',
            code: 'lowLiquidity',
        })
    })
})

describe('friendly error copy catalog', () => {
    // Every code friendlyError can return — the array element type is the
    // compile-time guard (a stray code fails typecheck); the loop guards the
    // en.json catalog at runtime, mirroring reject-labels.test.ts.
    const CODES: FriendlyErrorCode[] = [
        'balanceSettling',
        'insufficientFunds',
        'userRejectedTransaction',
        'notDeployedOnChain',
        'userRejectedRequest',
        'networkError',
        'nonceExpired',
        'walletNotConnected',
        'gasExceedsAllowance',
        'gasFeesNativeToken',
        'tokenPriceFetch',
        'tokenChainUndefined',
        'insufficientTokenBalance',
        'minimumSendAmount',
        'linkDetailsError',
        'passwordGenerationError',
        'gaslessDepositPayloadError',
        'prepareTransactionError',
        'switchNetworkError',
        'signDataError',
        'gaslessDepositApiError',
        'sendTransactionError',
        'transferAmountExceedsBalance',
        'chainMismatch',
        'insufficientBalance',
        'operationTimedOut',
        'passkeyNotCompleted',
        'claimLinkFailed',
        'sendLinkAlreadyClaimed',
        'lowLiquidity',
        'networkBusyTimeout',
        'sessionExpired',
        'genericSupport',
        'staleCardApproval',
        'rainInsufficientCollateral',
        'rainCooldownRetryShortly',
        'cardRateLimited',
        'linkTransactionHashFetch',
    ]

    const errors: Record<string, string> = en.errors

    it('has copy in en.json for every FriendlyErrorCode', () => {
        for (const code of CODES) {
            expect(errors[code]).toBeTruthy()
        }
    })

    it('has copy for the balance-gate code rendered directly by components', () => {
        expect(errors['notEnoughBalanceAddFunds']).toBeTruthy()
    })
})

describe('ApiError HTTP status discrimination', () => {
    const apiError = (status: number) =>
        Object.assign(new Error('authorization required'), { name: 'ApiError', status })

    test.each([401, 403])('a %i ApiError maps to sessionExpired, not "contact support"', (status) => {
        expect(friendlyError(apiError(status))).toEqual({ kind: 'code', code: 'sessionExpired' })
    })

    test('a 5xx ApiError maps to the retryable copy', () => {
        expect(friendlyError(apiError(503))).toEqual({ kind: 'code', code: 'networkBusyTimeout' })
    })

    test('a 4xx ApiError with an unmapped message still falls through to genericSupport', () => {
        expect(friendlyError(apiError(422))).toEqual({ kind: 'code', code: 'genericSupport' })
    })

    test('a numeric status on a non-ApiError is ignored', () => {
        const ethersish = Object.assign(new Error('server error'), { status: 500 })
        expect(friendlyError(ethersish)).toEqual({ kind: 'code', code: 'genericSupport' })
    })
})

describe('backend wire codes', () => {
    test('a wire-coded stale approval maps to localized copy instead of passthrough', () => {
        const stale = Object.assign(new Error('Your card needs to be re-enabled before you can withdraw.'), {
            name: 'StaleCardApprovalError',
            code: 'STALE_CARD_APPROVAL',
        })
        expect(friendlyError(stale)).toEqual({ kind: 'code', code: 'staleCardApproval' })
    })

    test('a wire-coded collateral shortfall maps to localized copy', () => {
        const err = Object.assign(new Error('Insufficient collateral balance for this withdrawal'), {
            code: 'INSUFFICIENT_COLLATERAL',
        })
        expect(friendlyError(err)).toEqual({ kind: 'code', code: 'rainInsufficientCollateral' })
    })

    test('cooldown yields minutes, rounded up and floored at 1', () => {
        const at = (retryAfterSec: number | null) =>
            Object.assign(new Error('A previous withdrawal is still active for this card.'), {
                code: 'WITHDRAWAL_COOLDOWN_ACTIVE',
                retryAfterSec,
            })
        expect(friendlyError(at(90))).toEqual({ kind: 'params', code: 'rainCooldownRetry', values: { minutes: 2 } })
        // 20s must not render "0 minutes"
        expect(friendlyError(at(20))).toEqual({ kind: 'params', code: 'rainCooldownRetry', values: { minutes: 1 } })
        expect(friendlyError(at(null))).toEqual({ kind: 'code', code: 'rainCooldownRetryShortly' })
    })

    test('both cooldown discriminants render the same copy', () => {
        const sigCooldown = Object.assign(new Error('A previous withdrawal signature is still active.'), {
            code: 'WITHDRAWAL_SIGNATURE_COOLDOWN',
            retryAfterSec: 120,
        })
        expect(friendlyError(sigCooldown)).toEqual({
            kind: 'params',
            code: 'rainCooldownRetry',
            values: { minutes: 2 },
        })
    })

    // The allow-list is load-bearing: third-party libraries set `.code` too, and
    // mapping an arbitrary one straight to a translation key would turn every
    // ethers error into a missing-message crash.
    test('an unknown .code falls through to the message matchers', () => {
        const ethersish = Object.assign(new Error('The request timed out.'), { code: 'NETWORK_ERROR' })
        expect(friendlyError(ethersish)).toEqual({ kind: 'code', code: 'networkBusyTimeout' })
    })

    test('a numeric .code (EIP-1193 wallets) is ignored', () => {
        const walletRejection = Object.assign(new Error('User rejected the request'), { code: 4001 })
        expect(friendlyError(walletRejection)).toEqual({ kind: 'code', code: 'userRejectedRequest' })
    })

    test('ServiceUnavailableError keeps the retryable timeout code', () => {
        // fetchWithSentry rethrows this with the real timeout on `.cause`, which
        // the classifier does not walk — without the name match it collapsed to
        // the generic support fallback.
        const wrapped = Object.assign(new Error('Service temporarily unavailable. Please try again.'), {
            name: 'ServiceUnavailableError',
        })
        expect(friendlyError(wrapped)).toEqual({ kind: 'code', code: 'networkBusyTimeout' })
    })

    test('the SDK transactionHash fetch failure is now localized, not passed through', () => {
        expect(friendlyError(new Error('Error getting the link with transactionHash 0xabc'))).toEqual({
            kind: 'code',
            code: 'linkTransactionHashFetch',
        })
    })
})
