/**
 * The contract behind review item B5: the API's feature report is the one
 * answer to "what can this user do", and every screen shows it. For each
 * fixture user, each screen's answer for each account must be the report's.
 */
import { QrKycState } from '@/constants/kyc.consts'
import { closeRefusedCorridors } from '@/features/deposit-accounts/reportClosures'
import { DEPOSIT_RAIL_ORDER, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { selectQrKycGate } from '@/features/payments/flows/qr-pay/qrKycGate.utils'
import { deriveCapabilityPhaseSignals } from '@/hooks/useMultiPhaseKycFlow'
import type { FeatureReport, FeatureReportEntry, NextAction, UserCapabilities } from '@/types/capabilities'
import { selectHomeTasks } from '@/utils/bridge-tasks.utils'
import { deriveGate, type GateState } from '@/utils/capability-gate'
import { bankAccountRow, buildBankRows, type BankRowKey } from '@/utils/unlock-payments.utils'
import { accountEntry, bestChip, entryChip, isMantecaAccountClosed, refusalOf } from '../report'

jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/app/actions/kyc-workflow', () => ({}))
jest.mock('@/app/actions/sumsub', () => ({}))
jest.mock('@/app/actions/users', () => ({}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const ACCOUNTS: { currency: string; feature: 'bank' | 'local'; row: BankRowKey | null; country: string }[] = [
    { currency: 'USD', feature: 'bank', row: 'usd', country: 'US' },
    { currency: 'EUR', feature: 'bank', row: 'sepa', country: 'DE' },
    { currency: 'GBP', feature: 'bank', row: null, country: 'GB' },
    { currency: 'MXN', feature: 'bank', row: 'mxn', country: 'MX' },
    { currency: 'BRL', feature: 'local', row: 'brl', country: 'BR' },
    { currency: 'ARS', feature: 'local', row: 'ars', country: 'AR' },
]

const tos: NextAction = { key: 'bridge-tos', kind: 'accept-tos', purpose: 'unlock-bridge', tosUrl: 'https://tos' }
const wait: NextAction = { key: 'bridge-wait', kind: 'wait', purpose: 'bridge-review' }
const restart: NextAction = { key: 'restart-identity', kind: 'restart-identity', purpose: 'document_country_unsupported' }
const support: NextAction = { key: 'contact-support', kind: 'contact-support', purpose: 'kyc-support' }
const poa: NextAction = { key: 'sumsub:proof_of_address', kind: 'sumsub', purpose: 'unlock-bridge', levelKey: 'proof_of_address' }

const ON: FeatureReportEntry = { state: 'on' }
const READY: FeatureReportEntry = { state: 'ready', action: 'activate' }
const VERIFY: FeatureReportEntry = { state: 'action_required', action: 'verify' }

function report(over: Partial<FeatureReport> = {}): FeatureReport {
    return {
        qr: ON,
        local: { ...READY, accounts: { BRL: READY, ARS: { state: 'refused', reason: 'local_residence_unsupported' } } },
        bank: { ...READY, accounts: { USD: READY, EUR: READY, GBP: READY, MXN: READY } },
        card: READY,
        ...over,
    }
}

/** The fixture users: the three disagreements B5 named, and the states around them. */
const FIXTURES: { name: string; features: FeatureReport; nextActions?: NextAction[] }[] = [
    {
        name: 'bank with EUR working and GBP pending',
        features: report({
            bank: {
                state: 'on',
                accounts: { USD: READY, EUR: ON, GBP: { state: 'setting_up', since: '2026-10-28' }, MXN: READY },
            },
        }),
    },
    {
        name: 'Bridge refused by the plan',
        features: report({
            bank: {
                state: 'refused',
                reason: 'document_country_unsupported',
                action: 'restart-identity',
                accounts: Object.fromEntries(
                    ['USD', 'EUR', 'GBP', 'MXN'].map((c) => [
                        c,
                        { state: 'refused', reason: 'document_country_unsupported', action: 'restart-identity' },
                    ])
                ),
            },
        }),
        nextActions: [restart],
    },
    {
        name: 'Manteca closed the Brazilian account, and the card is refused for the ID country',
        features: report({
            local: {
                state: 'refused',
                reason: 'manteca_account_rejected',
                accounts: {
                    BRL: { state: 'refused', reason: 'manteca_account_rejected', action: 'contact-support' },
                    ARS: { state: 'refused', reason: 'local_residence_unsupported' },
                },
            },
            card: { state: 'refused', reason: 'document_country_unsupported' },
        }),
        nextActions: [support],
    },
    {
        name: 'not verified yet',
        features: {
            qr: VERIFY,
            local: { ...VERIFY, accounts: { BRL: VERIFY, ARS: VERIFY } },
            bank: { ...VERIFY, accounts: { USD: VERIFY, EUR: VERIFY, GBP: VERIFY, MXN: VERIFY } },
            card: VERIFY,
        },
    },
    {
        name: 'Bridge waits on its terms, then on its review',
        features: report({
            bank: {
                state: 'action_required',
                action: 'bridge-tos',
                accounts: {
                    USD: { state: 'action_required', action: 'bridge-tos' },
                    EUR: { state: 'setting_up', reason: 'bridge_processing', action: 'bridge-wait' },
                    GBP: { state: 'refused', reason: 'account_unavailable_in_residence' },
                    MXN: { state: 'action_required', reason: 'proof_of_address', action: poa.key },
                },
            },
        }),
        nextActions: [tos, wait, poa],
    },
]

function capabilitiesOf(fixture: (typeof FIXTURES)[number]): UserCapabilities {
    return { rails: [], nextActions: fixture.nextActions ?? [], restrictions: [], features: fixture.features }
}

/** What each screen says about one account: usable, waiting, closed, or a step/offer. */
type Answer = 'usable' | 'waiting' | 'closed' | 'open'

const fromReport = (entry: FeatureReportEntry): Answer =>
    entry.state === 'on'
        ? 'usable'
        : entry.state === 'setting_up' || entry.state === 'pending'
          ? 'waiting'
          : entry.state === 'refused'
            ? 'closed'
            : 'open'

const fromGate = (gate: GateState, entry: FeatureReportEntry): Answer => {
    if (gate.kind === 'ready') return 'usable'
    if (gate.kind === 'pending' || gate.kind === 'waiting-on-provider') return 'waiting'
    if (gate.kind === 'blocked-rejection') return 'closed'
    // A new identity check is the way out of a refusal and a step alike; the report says which.
    if (gate.kind === 'restart-identity') return entry.state === 'refused' ? 'closed' : 'open'
    return 'open'
}

const fromPhases = (signals: ReturnType<typeof deriveCapabilityPhaseSignals>): Answer =>
    signals.allSettled ? 'usable' : signals.anyPending ? 'waiting' : signals.allBlocked ? 'closed' : 'open'

describe('every screen shows the feature report', () => {
    describe.each(FIXTURES)('$name', (fixture) => {
        const capabilities = capabilitiesOf(fixture)
        const state = { rails: [], nextActions: capabilities.nextActions, features: fixture.features, isLoading: false }
        const chips = Object.fromEntries(
            ACCOUNTS.filter((a) => a.row).map((a) => [
                a.row,
                entryChip(accountEntry(fixture.features, a.feature, a.currency), capabilities.nextActions),
            ])
        ) as Record<BankRowKey, ReturnType<typeof entryChip>>
        const rows = buildBankRows({
            bankChips: chips,
            closedBecause: {},
            residenceIso2: 'DE',
            secondResidenceIso2: null,
            isEuropeResidence: true,
        })

        it.each(ACCOUNTS)('$currency: gate, add-money phases and Money settings agree with the report', (account) => {
            const entry = accountEntry(fixture.features, account.feature, account.currency)
            const expected = fromReport(entry)

            const gate = deriveGate(state, 'deposit', { channel: 'bank', country: account.country === 'DE' ? 'EU' : account.country })
            expect(fromGate(gate, entry)).toBe(expected)

            const intent = account.feature === 'local' ? 'LATAM' : account.currency === 'EUR' ? 'EU' : 'NA'
            expect(fromPhases(deriveCapabilityPhaseSignals(capabilities, intent, account.country))).toBe(expected)

            if (account.row) {
                const row = rows.find((candidate) => candidate.labelKey === account.row)!
                // A refusal with a way out (support, a new identity check) is Attention; without one, Not available.
                // A step to take reads as an offer, mid-flight or Attention, never as working or closed.
                const chips: Record<Answer, string[]> = {
                    usable: ['active'],
                    waiting: ['processing'],
                    closed: entry.action ? ['attention'] : ['notAvailable'],
                    open: ['unlock', 'processing', 'attention'],
                }
                expect(chips[expected]).toContain(row.chip)
            }
        })

        it('the bank account row is the bank and local features as reported', () => {
            const featureChip = bestChip([
                entryChip(fixture.features.bank, capabilities.nextActions),
                entryChip(fixture.features.local, capabilities.nextActions),
            ])
            expect(bankAccountRow(rows, featureChip).chip).toBe(featureChip)
        })

        it('the deposit accounts list closes exactly the accounts the report refuses with no way out', () => {
            const empty = Object.fromEntries(DEPOSIT_RAIL_ORDER.map((c) => [c, undefined])) as Record<
                DepositCorridor,
                undefined
            >
            const { unavailable } = closeRefusedCorridors(fixture.features, [], {
                accounts: empty,
                claimable: empty,
                unavailable: empty,
            })
            for (const corridor of DEPOSIT_RAIL_ORDER) {
                const rail = DEPOSIT_RAILS[corridor]
                const feature = rail.provider === 'manteca' ? 'local' : 'bank'
                const entry = accountEntry(fixture.features, feature, rail.currency)
                expect([corridor, !!unavailable[corridor]]).toEqual([
                    corridor,
                    entry.state === 'refused' && !entry.action,
                ])
            }
        })

        it('QR pay, Home and Money settings read the same QR answer', () => {
            const qr = selectQrKycGate({ isLoading: false, features: fixture.features, nextActions: capabilities.nextActions })
            expect(qr.kycGateState === QrKycState.PROCEED_TO_PAY).toBe(fixture.features.qr.state === 'on')
        })

        it('the card and the Manteca top-up remember their refusals', () => {
            expect(refusalOf(fixture.features.card)).toBe(
                fixture.features.card.state === 'refused' ? fixture.features.card.reason : undefined
            )
            expect(isMantecaAccountClosed(fixture.features.local.accounts.BRL)).toBe(
                fixture.features.local.accounts.BRL?.reason === 'manteca_account_rejected'
            )
        })

        it('Home lists exactly the steps the report names', () => {
            const { largeTasks } = selectHomeTasks(capabilities.nextActions, fixture.features)
            const named = new Set(
                [
                    fixture.features.bank,
                    ...Object.values(fixture.features.bank.accounts),
                    fixture.features.local,
                    ...Object.values(fixture.features.local.accounts),
                    fixture.features.card,
                ]
                    .filter((entry) => entry.state === 'action_required' && entry.action)
                    .map((entry) => entry.action)
            )
            for (const task of largeTasks) expect(named.has(task.key.replace(/^[a-z]+-document:/, ''))).toBe(true)
        })
    })

    it('B5 disagreement 1: EUR working, GBP pending — Money settings and every flow say the same per currency', () => {
        const fixture = FIXTURES[0]
        const caps = capabilitiesOf(fixture)
        expect(entryChip(accountEntry(fixture.features, 'bank', 'EUR'), [])).toBe('active')
        expect(deriveGate({ rails: [], nextActions: [], features: fixture.features, isLoading: false }, 'deposit', { channel: 'bank', country: 'GB' }).kind).toBe('pending')
        expect(deriveCapabilityPhaseSignals(caps, 'EU', 'DE').allSettled).toBe(true)
        expect(deriveCapabilityPhaseSignals(caps, 'NA', 'GB').anyPending).toBe(true)
    })

    it('B5 disagreement 2: a provider the plan refused is never Pending', () => {
        const fixture = FIXTURES[1]
        for (const currency of ['USD', 'EUR', 'MXN']) {
            expect(entryChip(accountEntry(fixture.features, 'bank', currency), fixture.nextActions!)).toBe('attention')
        }
        expect(deriveCapabilityPhaseSignals(capabilitiesOf(fixture), 'EU', 'DE').anyPending).toBe(false)
    })

    it('B5 disagreement 3: the Manteca closure and the card refusal come from the report, not a caught error', () => {
        const fixture = FIXTURES[2]
        expect(isMantecaAccountClosed(fixture.features.local.accounts.BRL)).toBe(true)
        expect(refusalOf(fixture.features.card)).toBe('document_country_unsupported')
    })
})
