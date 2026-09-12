import { AccountType, type Account, type SavedAddress } from '@/interfaces/interfaces'
import {
    accountDestination,
    byMostRecentlyUsed,
    destinationLabel,
    savedAddressDestination,
    type SavedDestination,
} from '../saved-destinations'

const account = (over: Partial<Account> & Pick<Account, 'type' | 'identifier'>): Account =>
    ({
        id: 'acct-1',
        userId: 'user-1',
        bridgeAccountId: '',
        label: null,
        lastUsedAt: null,
        details: { bankName: null, accountOwnerName: 'Ada', countryCode: '', countryName: '' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        chainId: null,
        ...over,
    }) as Account

const savedAddress = (over: Partial<SavedAddress> = {}): SavedAddress => ({
    id: 'saved-1',
    address: '0x28c6c06298d514db089934071355e5743bf21aeC9',
    chainId: '42161',
    nickname: 'Binance',
    lastUsedAt: '2026-08-10T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
})

describe('destinationLabel', () => {
    it('a name the user gave wins over the automatic one', () => {
        const bank = account({
            type: AccountType.IBAN,
            identifier: 'ES27007509842206070802',
            label: 'Payroll',
            details: { bankName: 'Banco Fixture', accountOwnerName: 'Ada', countryCode: 'ESP', countryName: 'spain' },
        })
        expect(destinationLabel(accountDestination(bank, { countryName: 'Spain' }))).toBe('Payroll')
    })

    it('a whitespace-only name is no name at all', () => {
        const bank = account({ type: AccountType.US, identifier: '938636999398030', label: '   ' })
        expect(destinationLabel(accountDestination(bank, { countryName: 'United States' }))).toBe(
            'United States · 8030'
        )
    })

    it('bank: the bank name, or the country, plus the last four', () => {
        const named = account({
            type: AccountType.IBAN,
            identifier: 'ES27007509842206070802',
            details: { bankName: 'Banco Fixture', accountOwnerName: 'Ada', countryCode: 'ESP', countryName: 'spain' },
        })
        expect(destinationLabel(accountDestination(named, { countryName: 'Spain' }))).toBe('Banco Fixture · 0802')

        const unnamed = account({ type: AccountType.GB, identifier: '12345678' })
        expect(destinationLabel(accountDestination(unnamed, { countryName: 'United Kingdom' }))).toBe(
            'United Kingdom · 5678'
        )
    })

    it('Mercado Pago: a CVU is named for the wallet that issued it', () => {
        const cvu = account({
            type: AccountType.MANTECA,
            identifier: '0000003100066354450371',
            details: { bankName: null, accountOwnerName: 'Ada', countryCode: 'ARG', countryName: 'argentina' },
        })
        expect(destinationLabel(accountDestination(cvu, { countryName: 'Argentina' }))).toBe('Mercado Pago · 0371')
    })

    it('Argentina: a bank CBU is not a wallet — it keeps the country name', () => {
        const cbu = account({
            type: AccountType.MANTECA,
            identifier: '2850590940090418135201',
            details: { bankName: null, accountOwnerName: 'Ada', countryCode: 'ARG', countryName: 'argentina' },
        })
        expect(destinationLabel(accountDestination(cbu, { countryName: 'Argentina' }))).toBe('Argentina · 5201')
    })

    it('PIX: the key, masked', () => {
        const pix = account({
            type: AccountType.MANTECA,
            identifier: 'ada@peanut.me',
            details: { bankName: null, accountOwnerName: 'Ada', countryCode: 'BRA', countryName: 'brazil' },
        })
        expect(destinationLabel(accountDestination(pix, { countryName: 'Brazil' }))).toBe('PIX · ada@peanut.me')
    })

    it('crypto: the nickname, and the address tail when there is none', () => {
        expect(destinationLabel(savedAddressDestination(savedAddress()))).toBe('Binance')
        expect(destinationLabel(savedAddressDestination(savedAddress({ nickname: '' })))).toBe(' · ...aeC9')
    })
})

describe('byMostRecentlyUsed', () => {
    const dest = (over: Partial<SavedDestination>): SavedDestination => ({
        id: 'x',
        name: null,
        autoName: 'x',
        identifier: 'x',
        lastUsedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...over,
    })

    it('puts the most recent use first', () => {
        const older = dest({ id: 'older', lastUsedAt: '2026-07-01T00:00:00.000Z' })
        const newer = dest({ id: 'newer', lastUsedAt: '2026-08-01T00:00:00.000Z' })
        expect([older, newer].sort(byMostRecentlyUsed).map((d) => d.id)).toEqual(['newer', 'older'])
    })

    it('a destination never used sorts after every one that has been', () => {
        const never = dest({ id: 'never', lastUsedAt: null, createdAt: '2026-09-01T00:00:00.000Z' })
        const used = dest({ id: 'used', lastUsedAt: '2026-02-01T00:00:00.000Z' })
        expect([never, used].sort(byMostRecentlyUsed).map((d) => d.id)).toEqual(['used', 'never'])
    })

    it('falls back to the newest added', () => {
        const old = dest({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' })
        const fresh = dest({ id: 'fresh', createdAt: '2026-05-01T00:00:00.000Z' })
        expect([old, fresh].sort(byMostRecentlyUsed).map((d) => d.id)).toEqual(['fresh', 'old'])
    })
})
