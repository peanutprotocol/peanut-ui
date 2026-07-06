import { ErrorHandler, rainCollateralErrorMessage } from '../friendly-error.utils'

describe('ErrorHandler', () => {
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

        test('maps the verbatim ZeroDev sponsor timeout to retryable copy', () => {
            expect(ErrorHandler(timeoutError)).toBe(
                'The network is busy and your request timed out. Please try again in a moment.'
            )
        })

        test('matches a bare "The request timed out" message', () => {
            expect(ErrorHandler(new Error('The request timed out.'))).toBe(
                'The network is busy and your request timed out. Please try again in a moment.'
            )
        })

        test('maps fetchWithSentry AbortError copy ("timed out after <ms>ms")', () => {
            // Verbatim shape from sentry.utils.ts AbortError path. The Bridge
            // offramp `/confirm` 10s timeout (Konrad, 2026-06-01, PEANUT-UI-QH9)
            // would otherwise fall through to the generic "contact support"
            // copy and surface a Retry button next to an on-chain leg that
            // already fired — risking a double-pay.
            const fetchTimeoutError = new Error(
                'Request to https://api.peanut.me/bridge/transfers/01e7a858-a849-4daa-9df7-e680d47bcfc1/confirm timed out after 10000ms'
            )
            expect(ErrorHandler(fetchTimeoutError)).toBe(
                'The network is busy and your request timed out. Please try again in a moment.'
            )
        })

        test('does NOT hijack the WebAuthn "operation either timed out" message', () => {
            // Ordering guard: the passkey-prompt timeout has its own copy and is
            // matched earlier; the generic timeout matcher must not swallow it.
            expect(ErrorHandler(new Error('The operation either timed out or was not allowed'))).toBe(
                'Please confirm the transaction.'
            )
        })
    })

    describe('WebAuthn NotAllowedError (passkey ceremony refused)', () => {
        test('maps the verbatim iOS Safari message to retry/unlock guidance', () => {
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
            expect(ErrorHandler(webAuthnRefused)).toBe(
                "Your device didn't complete the passkey confirmation. Try again — if it keeps failing, unlock your password manager (e.g. 1Password) or restart your device."
            )
        })
    })

    test('unknown errors still fall through to the support fallback', () => {
        expect(ErrorHandler(new Error('something nobody mapped'))).toBe(
            'There was an issue with your request. Please contact support.'
        )
    })

    test('rain collateral errors pass through verbatim ahead of the timeout matcher', () => {
        const cooldown = new Error('A previous withdrawal is still active for this card. Try again in about 2 min.')
        expect(rainCollateralErrorMessage(cooldown)).toBe(cooldown.message)
        expect(ErrorHandler(cooldown)).toBe(cooldown.message)
    })

    test('stale-card-approval surfaces its friendly copy inline, not the "contact support" fallback', () => {
        // Matched by error name so the inline path matches the global re-enable
        // modal instead of dead-ending on the generic support fallback.
        const stale = new Error('Your card needs to be re-enabled before you can withdraw.')
        stale.name = 'StaleCardApprovalError'
        expect(rainCollateralErrorMessage(stale)).toBe(stale.message)
        expect(ErrorHandler(stale)).toBe(stale.message)
    })
})
