import fc from 'fast-check'
import {
    deriveGate,
    gateFromEntry,
    gateRemedy,
    resolveKycModalVariant,
    type CapabilityState,
    type GateScope,
} from '@/utils/capability-gate'
import { entryChip } from '@/features/kyc-features/report'
import type { FeatureReport, FeatureReportEntry, NextAction, RailOperation } from '@/types/capabilities'

const OPERATIONS: RailOperation[] = ['deposit', 'withdraw', 'pay']
const ENTRY_STATES = [
    'on',
    'setting_up',
    'pending',
    'ready',
    'action_required',
    'refused',
    'not_requested',
    'unknown_future_state',
] as const
const ACTION_KINDS = [
    'sumsub',
    'bridge-hosted',
    'rain-hosted',
    'accept-tos',
    'restart-identity',
    'provide-email',
    'contact-support',
    'wait',
] as const
const REASONS = [
    undefined,
    'duplicate_account',
    'imported_identity_rejected',
    'uk_resident_blocked',
    'residence_bank_restricted',
    'residence_sanctioned',
    'provider_error_weird_code',
] as const

const arbAction: fc.Arbitrary<NextAction> = fc.record({
    key: fc.constantFrom('act-1', 'act-2', 'sumsub:residence_address'),
    kind: fc.constantFrom(...ACTION_KINDS),
    tosUrl: fc.option(fc.constant('https://bridge.xyz/tos'), { nil: undefined }),
    effectiveDate: fc.option(fc.constant('2027-01-01'), { nil: undefined }),
    requirementKey: fc.option(fc.constant('poa'), { nil: undefined }),
}) as fc.Arbitrary<NextAction>

const arbEntry: fc.Arbitrary<FeatureReportEntry> = fc.record({
    state: fc.constantFrom(...ENTRY_STATES),
    reason: fc.constantFrom(...REASONS),
    message: fc.option(fc.constant('Provider note'), { nil: undefined }),
    action: fc.option(fc.constantFrom('verify', 'identity', 'act-1', 'act-2', 'supplement:poa', 'unknown_key'), {
        nil: undefined,
    }),
    since: fc.option(fc.constant('2026-11-20T00:00:00Z'), { nil: undefined }),
}) as fc.Arbitrary<FeatureReportEntry>

const arbAccounts = fc.dictionary(fc.constantFrom('EUR', 'USD', 'GBP', 'MXN', 'ARS', 'BRL'), arbEntry)
const arbEntryWithAccounts = fc
    .tuple(arbEntry, fc.option(arbAccounts, { nil: undefined }))
    .map(([entry, accounts]) => ({ ...entry, ...(accounts ? { accounts } : {}) }))

const arbFeatures: fc.Arbitrary<FeatureReport> = fc.record({
    qr: arbEntry,
    bank: arbEntryWithAccounts,
    local: arbEntryWithAccounts,
    card: arbEntry,
}) as fc.Arbitrary<FeatureReport>

describe('capability-gate exhaustive state simulation (no user stuck)', () => {
    it('gateFromEntry and entryChip are total over arbitrary and unknown API states', () => {
        fc.assert(
            fc.property(arbEntry, fc.array(arbAction, { maxLength: 3 }), (entry, nextActions) => {
                const gate = gateFromEntry(entry, { rails: [], nextActions })
                expect(gate).toBeDefined()
                expect(typeof gate.kind).toBe('string')

                const remedy = gateRemedy(gate)
                expect(typeof remedy).toBe('string')

                const variant = resolveKycModalVariant(gate)
                expect(typeof variant).toBe('string')

                const chip = entryChip(entry, nextActions)
                expect(['active', 'processing', 'attention', 'unlock', 'notAvailable']).toContain(chip)
            }),
            { numRuns: 500 }
        )
    })

    it('action_required with contact-support never routes to provider-fix', () => {
        const contactSupportAction: NextAction = { key: 'act-support', kind: 'contact-support' } as NextAction
        const entry: FeatureReportEntry = {
            state: 'action_required',
            action: 'act-support',
            reason: 'manual_review_blocked',
            message: 'Contact support to continue',
        }
        const gate = gateFromEntry(entry, { rails: [], nextActions: [contactSupportAction] })
        expect(gate.kind).toBe('blocked-rejection')
        expect(gateRemedy(gate)).toBe('support')
    })

    it('identityHold outranks any non-working feature report entry in deriveGate', () => {
        fc.assert(
            fc.property(
                arbFeatures,
                fc.array(arbAction, { maxLength: 2 }),
                fc.constantFrom(...OPERATIONS),
                fc.constantFrom<GateScope>({}, { provider: 'bridge' }, { provider: 'manteca' }, { country: 'US' }),
                fc.constantFrom<'duplicate_account' | 'imported_identity_rejected'>(
                    'duplicate_account',
                    'imported_identity_rejected'
                ),
                (features, nextActions, op, scope, identityHold) => {
                    const state: CapabilityState = {
                        isLoading: false,
                        rails: [],
                        nextActions,
                        identityVerified: false,
                        identityHold,
                        features,
                    }
                    const gate = deriveGate(state, op, scope)
                    expect(gate).toBeDefined()
                    if (gate.kind !== 'ready') {
                        expect(gate.kind).toBe('blocked-rejection')
                        expect(gateRemedy(gate)).toBe('support')
                    }
                }
            ),
            { numRuns: 300 }
        )
    })
})
