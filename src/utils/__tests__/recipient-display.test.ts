import { resolveRecipientDisplay } from '../recipient-display'

describe('resolveRecipientDisplay', () => {
    describe('username preference (wins over everything)', () => {
        it('returns username when user.username is set', () => {
            const result = resolveRecipientDisplay({
                user: { username: 'hugo0' },
                address: '0xb009da0b0824ba04bfd7eb2757e064a8e184d338',
            })
            expect(result).toEqual({ displayName: 'hugo0', kind: 'username' })
        })

        it('prefers username over ENS name', () => {
            const result = resolveRecipientDisplay({
                user: { username: 'hugo0' },
                address: '0xb009da0b0824ba04bfd7eb2757e064a8e184d338',
                ensName: 'vitalik.eth',
            })
            expect(result).toEqual({ displayName: 'hugo0', kind: 'username' })
        })
    })

    describe('ENS fallback (when no username)', () => {
        it('returns ENS name when no username but ensName is set', () => {
            const result = resolveRecipientDisplay({
                user: null,
                address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
                ensName: 'vitalik.eth',
            })
            expect(result).toEqual({ displayName: 'vitalik.eth', kind: 'ens' })
        })

        it('returns ENS name when user is undefined', () => {
            const result = resolveRecipientDisplay({
                address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
                ensName: 'vitalik.eth',
            })
            expect(result).toEqual({ displayName: 'vitalik.eth', kind: 'ens' })
        })
    })

    describe('address fallback', () => {
        it('returns printable address when nothing else is available', () => {
            const result = resolveRecipientDisplay({
                address: '0xb009da0b0824ba04bfd7eb2757e064a8e184d338',
            })
            expect(result.kind).toBe('address')
            // printableAddress shortens; just check it's a shortened form, not
            // brittle on the exact char-count which lives in general.utils
            expect(result.displayName).toContain('0xb009')
            expect(result.displayName).toContain('d338')
        })

        it('falls back to address when user has no username (null/empty)', () => {
            const result = resolveRecipientDisplay({
                user: { username: null },
                address: '0xb009da0b0824ba04bfd7eb2757e064a8e184d338',
            })
            expect(result.kind).toBe('address')
        })
    })

    describe('the bug we fixed', () => {
        // BE returned EVM-typed recipientAccount for a Peanut user. Old code
        // checked `type === PEANUT_WALLET` and never matched → fell to address
        // branch. Reproduce by giving the resolver the user object directly
        // (which is what the new BE shape contains regardless of `type`).
        it('uses username when a user is linked, even on a non-PEANUT_WALLET account', () => {
            const result = resolveRecipientDisplay({
                user: { username: 'hugo0' },
                address: '0xb009da0b0824ba04bfd7eb2757e064a8e184d338',
            })
            expect(result.displayName).toBe('hugo0')
        })
    })
})
