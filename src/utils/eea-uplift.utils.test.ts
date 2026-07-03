import { upliftTriggerFromGate, upliftTriggerFromAdvisory, EEA_UPLIFT_REQUIREMENT_KEYS } from './eea-uplift.utils'
import type { GateState, GateAdvisory } from '@/utils/capability-gate'

describe('upliftTriggerFromGate (blocking path)', () => {
    test('returns a blocking trigger for an eea_uplift fixable-rejection', () => {
        const gate = { kind: 'fixable-rejection', userMessage: 'x', reason: { code: 'eea_uplift', userMessage: 'x' } }
        expect(upliftTriggerFromGate(gate as GateState)).toEqual({ requirementKey: 'eea_uplift', source: 'blocking' })
    })

    test('matches the eea_uplift_with_tin variant', () => {
        const gate = {
            kind: 'fixable-rejection',
            userMessage: 'x',
            reason: { code: 'eea_uplift_with_tin', userMessage: 'x' },
        }
        expect(upliftTriggerFromGate(gate as GateState)?.requirementKey).toBe('eea_uplift_with_tin')
    })

    test('returns null for a non-uplift rejection', () => {
        const gate = {
            kind: 'fixable-rejection',
            userMessage: 'x',
            reason: { code: 'document_rejected', userMessage: 'x' },
        }
        expect(upliftTriggerFromGate(gate as GateState)).toBeNull()
    })

    test('returns null for a gate variant without a reason', () => {
        expect(upliftTriggerFromGate({ kind: 'ready' } as GateState)).toBeNull()
        expect(upliftTriggerFromGate({ kind: 'needs-identity' } as GateState)).toBeNull()
    })
})

describe('upliftTriggerFromAdvisory (advisory path)', () => {
    test.each([...EEA_UPLIFT_REQUIREMENT_KEYS])('builds an advisory trigger for uplift key: %s', (requirementKey) => {
        const advisory: GateAdvisory = { effectiveDate: '2026-12-31', actionKey: 'k', requirementKey }
        expect(upliftTriggerFromAdvisory(advisory)).toEqual({
            requirementKey,
            actionKey: 'k',
            effectiveDate: '2026-12-31',
            source: 'advisory',
        })
    })

    test('returns null for a co-occurring non-uplift key (proof_of_address / gov-id)', () => {
        const advisory: GateAdvisory = {
            effectiveDate: '2026-06-29',
            actionKey: 'k',
            requirementKey: 'proof_of_address_document',
        }
        expect(upliftTriggerFromAdvisory(advisory)).toBeNull()
    })

    test('is safe for undefined / keyless advisory', () => {
        expect(upliftTriggerFromAdvisory(undefined)).toBeNull()
        expect(upliftTriggerFromAdvisory({ effectiveDate: '2026-12-31', actionKey: 'k' })).toBeNull()
    })
})
