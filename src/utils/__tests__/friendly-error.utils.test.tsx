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

        test('does NOT hijack the WebAuthn "operation either timed out" message', () => {
            // Ordering guard: the passkey-prompt timeout has its own copy and is
            // matched earlier; the generic timeout matcher must not swallow it.
            expect(ErrorHandler(new Error('The operation either timed out or was not allowed'))).toBe(
                'Please confirm the transaction.'
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
})
