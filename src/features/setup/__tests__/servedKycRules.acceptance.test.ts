import { setupChannelsForResidence } from '@/features/setup/paymentChannels'
import { residenceAvailability } from '@/utils/residence-availability'
import { deriveResidenceRestrictionsFrom } from '@/hooks/useResidenceRestrictions'
import { regionIntentForResidence } from '@/utils/regions.utils'

// Acceptance fixtures come from the served-rules contract, independently of implementation.
function rules(
    overrides: Partial<
        Record<
            'full' | 'cardOnly' | 'bankingOnly' | 'refusedIdIssuers' | 'bankingNewCustomersOnly',
            ReadonlySet<string>
        >
    > = {}
) {
    return {
        full: new Set<string>(),
        cardOnly: new Set<string>(),
        bankingOnly: new Set<string>(),
        refusedIdIssuers: new Set<string>(),
        bankingNewCustomersOnly: new Set<string>(),
        ...overrides,
    }
}

function intents(currencies: string[], bankAvailable = true) {
    return {
        qr: { available: false },
        local: { available: false },
        card: { available: false },
        bank: { available: bankAvailable, currencies },
    }
}

describe('served KYC rules acceptance', () => {
    describe('authoritative currency rails', () => {
        it.each([
            ['CF', ['USD'], ['usdAch', 'p2p']],
            ['MX', ['MXN', 'USD', 'EUR', 'GBP'], ['spei', 'usdAch', 'eurSepa', 'gbpFps', 'p2p']],
            ['PT', ['GBP', 'EUR'], ['gbpFps', 'eurSepa', 'p2p']],
            ['GB', ['EUR'], ['eurSepa', 'p2p']],
        ])('%s exposes only served currencies in API order', (residence, currencies, expected) => {
            expect(
                residenceAvailability(rules(), residence as string, intents(currencies as string[])).available
            ).toEqual(expected)
        })

        it.each(['CF', 'MX', 'PT', 'GB'])('%s does not invent named rails while intents are missing', (residence) => {
            const available = residenceAvailability(rules(), residence).available
            for (const rail of ['usdAch', 'eurSepa', 'gbpFps', 'spei']) expect(available).not.toContain(rail)
        })

        it.each([{ currencies: [] }, { currencies: ['JPY'] }])(
            'does not invent a supported currency rail from $currencies',
            ({ currencies }) => {
                const available = residenceAvailability(rules(), 'CF', intents(currencies)).available
                for (const rail of ['usdAch', 'eurSepa', 'gbpFps', 'spei']) expect(available).not.toContain(rail)
            }
        )

        it('does not expose bank rails when authoritative banking is closed', () => {
            expect(
                residenceAvailability(rules(), 'MX', intents(['MXN', 'USD', 'EUR', 'GBP'], false)).available
            ).toEqual(['p2p'])
        })
    })

    describe('QR residence sanction fallback', () => {
        it.each(['CN', 'GB', 'VE', 'IQ', 'PS', 'YE', 'SS', 'CD'])(
            '%s full banking/card restriction does not close QR',
            (residence) => {
                const sets = rules({ full: new Set([residence]), refusedIdIssuers: new Set(['IR']) })
                expect(setupChannelsForResidence(sets, residence, true).payment).toContain('qr')
            }
        )

        it.each(['IR', 'RU'])('%s sanctioned residence closes fallback QR', (residence) => {
            const sets = rules({ refusedIdIssuers: new Set(['IR']) })
            expect(setupChannelsForResidence(sets, residence, true).payment).not.toContain('qr')
        })

        it('uses updated served issuer restrictions for fallback QR', () => {
            expect(setupChannelsForResidence(rules(), 'PT', true).payment).toContain('qr')
            expect(
                setupChannelsForResidence(rules({ refusedIdIssuers: new Set(['PT']) }), 'PT', true).payment
            ).not.toContain('qr')
        })

        it.each([true, false])('authoritative QR availability %s wins over fallback', (qr) => {
            for (const residence of ['PT', 'IR', 'RU']) {
                const sets = rules({ refusedIdIssuers: new Set(['IR']) })
                const payment = setupChannelsForResidence(sets, residence, true, {
                    ...intents([]),
                    qr: { available: qr },
                }).payment
                expect(payment.includes('qr')).toBe(qr)
            }
        })
    })

    describe('new customer banking restriction', () => {
        it.each([undefined, false])('closes banking for KR customer status %s', (existing) => {
            const sets = rules({ bankingOnly: new Set(['KR']), bankingNewCustomersOnly: new Set(['KR']) })
            expect(deriveResidenceRestrictionsFrom(sets, 'KR', existing)).toEqual({ banking: true, card: false })
        })

        it('keeps existing KR banking open when the served restriction is new-customers-only', () => {
            const sets = rules({ bankingOnly: new Set(['KR']), bankingNewCustomersOnly: new Set(['KR']) })
            expect(deriveResidenceRestrictionsFrom(sets, 'KR', true)).toEqual({ banking: false, card: false })
        })

        it('preserves the existing-bank exemption under full overlap without reopening card', () => {
            const sets = rules({
                full: new Set(['KR']),
                bankingOnly: new Set(['KR']),
                bankingNewCustomersOnly: new Set(['KR']),
            })
            expect(deriveResidenceRestrictionsFrom(sets, 'KR', true)).toEqual({ banking: false, card: true })
        })

        it.each(['full', 'bankingOnly'] as const)(
            'does not exempt an existing customer from unqualified %s',
            (field) => {
                const sets = rules({ [field]: new Set(['KR']) })
                expect(deriveResidenceRestrictionsFrom(sets, 'KR', true).banking).toBe(true)
            }
        )

        it('leaves both products open for empty served restrictions', () => {
            expect(deriveResidenceRestrictionsFrom(rules(), 'PT')).toEqual({ banking: false, card: false })
        })
    })

    describe('routing follows served rules', () => {
        it('responds to a newly served banking restriction for PT', () => {
            expect(regionIntentForResidence('PT', rules())).toBe('EU')
            expect(regionIntentForResidence('PT', rules({ bankingOnly: new Set(['PT']) }))).toBe('ROW')
        })

        it.each([undefined, false, true])(
            'routes PT with new-customer restriction and customer status %s',
            (existing) => {
                const sets = rules({ bankingOnly: new Set(['PT']), bankingNewCustomersOnly: new Set(['PT']) })
                expect(regionIntentForResidence('PT', sets, existing)).toBe(existing ? 'EU' : 'ROW')
            }
        )
    })

    it('repeated pure calls are stable and preserve input currency order', () => {
        const sets = rules({ bankingOnly: new Set(['KR']), bankingNewCustomersOnly: new Set(['KR']) })
        const servedIntents = intents(['MXN', 'USD', 'EUR', 'GBP'])
        const first = residenceAvailability(sets, 'MX', servedIntents)
        for (let attempt = 0; attempt < 20; attempt++) {
            expect(residenceAvailability(sets, 'MX', servedIntents)).toEqual(first)
            expect(deriveResidenceRestrictionsFrom(sets, 'KR', true)).toEqual({ banking: false, card: false })
            expect(regionIntentForResidence('PT', sets)).toBe('EU')
        }
        expect(servedIntents.bank.currencies).toEqual(['MXN', 'USD', 'EUR', 'GBP'])
        expect([...sets.bankingOnly]).toEqual(['KR'])
    })
})

jest.mock('@/app/actions/clients', () => ({}))
