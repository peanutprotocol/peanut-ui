import { eeaUpliftReasonCode, isEeaUpliftAdvisory, EEA_UPLIFT_REQUIREMENT_KEYS } from './eea-uplift.utils'
import type { GateState, GateAdvisory } from '@/utils/capability-gate'

describe('eeaUpliftReasonCode (blocking path)', () => {
    test('returns the code for an eea_uplift fixable-rejection', () => {
        const gate = { kind: 'fixable-rejection', userMessage: 'x', reason: { code: 'eea_uplift', userMessage: 'x' } }
        expect(eeaUpliftReasonCode(gate as GateState)).toBe('eea_uplift')
    })

    test('matches the eea_uplift_with_tin variant', () => {
        const gate = {
            kind: 'fixable-rejection',
            userMessage: 'x',
            reason: { code: 'eea_uplift_with_tin', userMessage: 'x' },
        }
        expect(eeaUpliftReasonCode(gate as GateState)).toBe('eea_uplift_with_tin')
    })

    test('returns undefined for a non-uplift rejection', () => {
        const gate = {
            kind: 'fixable-rejection',
            userMessage: 'x',
            reason: { code: 'document_rejected', userMessage: 'x' },
        }
        expect(eeaUpliftReasonCode(gate as GateState)).toBeUndefined()
    })

    test('returns undefined for a gate variant without a reason', () => {
        expect(eeaUpliftReasonCode({ kind: 'ready' } as GateState)).toBeUndefined()
        expect(eeaUpliftReasonCode({ kind: 'needs-identity' } as GateState)).toBeUndefined()
    })
})

describe('isEeaUpliftAdvisory (advisory path)', () => {
    test.each([...EEA_UPLIFT_REQUIREMENT_KEYS])('matches uplift requirement key: %s', (requirementKey) => {
        const advisory: GateAdvisory = { effectiveDate: '2026-12-31', actionKey: 'k', requirementKey }
        expect(isEeaUpliftAdvisory(advisory)).toBe(true)
    })

    test('does not match a co-occurring non-uplift key (proof_of_address / gov-id)', () => {
        const advisory: GateAdvisory = {
            effectiveDate: '2026-06-29',
            actionKey: 'k',
            requirementKey: 'proof_of_address_document',
        }
        expect(isEeaUpliftAdvisory(advisory)).toBe(false)
    })

    test('is safe for undefined / keyless advisory', () => {
        expect(isEeaUpliftAdvisory(undefined)).toBe(false)
        expect(isEeaUpliftAdvisory({ effectiveDate: '2026-12-31', actionKey: 'k' })).toBe(false)
    })
})
