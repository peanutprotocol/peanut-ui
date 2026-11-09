/**
 * TASK-24662: the address step, as the corridors and the bank rows read it.
 * A corridor waiting for the home address is one tap from the step, and a
 * residence the backend refuses is still "not available".
 */
import { entryChip } from '@/features/kyc-features/report'
import type { NextAction } from '@/types/capabilities'
import type { GateState } from '@/utils/capability-gate'
import { addressStepOf, isAddressStepGate } from '../addressStep'
import { virtualAccountRows } from '../hubRows'
import { corridorRecord, emptyCorridorRecord } from '../rails'
import type { DepositAccountView, UnavailableCorridor } from '../types'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const action = (purpose: string): NextAction => ({
    key: 'sumsub:address_of_residence',
    kind: 'sumsub',
    purpose,
    levelKey: 'address_of_residence',
})
const addressGate = (purpose = 'residence_address_required'): GateState => ({
    kind: 'fixable-rejection',
    userMessage: null,
    reason: { code: 'residence_unresolved', userMessage: '' },
    actionKey: 'sumsub:address_of_residence',
    nextAction: action(purpose),
})
const withheld = (cause: UnavailableCorridor['cause']): UnavailableCorridor => ({
    railId: 'bridge.ach_us',
    method: 'ACH_US',
    country: 'US',
    currency: 'USD',
    reason: 'not-offered',
    cause,
})

describe('addressStepOf', () => {
    it.each<[UnavailableCorridor['cause'], GateState, string | null]>([
        ['address-required', addressGate(), 'required'],
        ['address-required', addressGate('residence_address_rejected'), 'rejected'],
        ['address-in-review', { kind: 'pending' }, 'in_review'],
        ['residence-restricted', addressGate(), null],
        ['not-open', addressGate(), null],
    ])('%s with this gate is %s', (cause, gate, state) => {
        expect(addressStepOf(withheld(cause), gate)).toBe(state)
    })

    it('needs the backend to name the corridor: the gate alone decides nothing', () => {
        expect(addressStepOf(undefined, addressGate())).toBeNull()
    })

    it('knows the gate that opens the step itself', () => {
        expect(isAddressStepGate(addressGate())).toBe(true)
        expect(isAddressStepGate({ kind: 'needs-identity' })).toBe(false)
        expect(isAddressStepGate({ ...addressGate(), actionKey: 'sumsub:proof_of_address' } as GateState)).toBe(false)
    })
})

describe('the open-account rows', () => {
    const input = (cause: UnavailableCorridor['cause']) => ({
        corridors: ['ACH_US' as const],
        accounts: emptyCorridorRecord<DepositAccountView>(),
        unavailable: { ...emptyCorridorRecord<UnavailableCorridor>(), ACH_US: withheld(cause) },
        gates: corridorRecord<GateState>(() => addressGate()),
    })

    it.each<UnavailableCorridor['cause']>(['address-required', 'address-in-review'])(
        'a corridor whose cause is %s opens: the step or its wait explains it',
        (cause) => {
            const row = virtualAccountRows(input(cause), true).open.find((open) => open.corridor === 'ACH_US')
            expect(row?.openable).toBe(true)
        }
    )

    it('a residence the backend refuses does not open', () => {
        const row = virtualAccountRows(input('residence-restricted'), true).open.find(
            (open) => open.corridor === 'ACH_US'
        )
        expect(row?.openable).toBe(false)
    })
})

describe('the bank row chip', () => {
    it('says the user has to act on the address step, never "processing"', () => {
        const entry = {
            state: 'action_required',
            reason: 'residence_unresolved',
            action: 'sumsub:address_of_residence',
        }
        expect(entryChip(entry as never, [action('residence_address_required')])).toBe('attention')
    })

    it('keeps another Sumsub step as it was', () => {
        const entry = { state: 'action_required', action: 'sumsub:tax_identification_number' }
        expect(
            entryChip(entry as never, [{ key: 'sumsub:tax_identification_number', kind: 'sumsub', purpose: 'x' }])
        ).toBe('processing')
    })

    it('reads the review as in progress', () => {
        expect(entryChip({ state: 'setting_up', reason: 'residence_address_in_review' } as never, [])).toBe(
            'processing'
        )
    })
})
