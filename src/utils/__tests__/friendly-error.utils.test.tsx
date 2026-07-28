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

    test('rain collateral errors pass BACKEND text through verbatim, ahead of the timeout matcher', () => {
        const cooldown = new Error('A previous withdrawal is still active for this card. Try again in about 2 min.')
        expect(rainCollateralErrorMessage(cooldown)).toBe(cooldown.message)
        expect(friendlyError(cooldown)).toEqual({ kind: 'text', text: cooldown.message })
    })

    test('stale-card-approval passes its backend copy through as text, not the fallback code', () => {
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
        'genericSupport',
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
