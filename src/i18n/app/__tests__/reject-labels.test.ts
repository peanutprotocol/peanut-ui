import {
    FALLBACK_REJECT_LABEL_CODE,
    REJECT_LABEL_CODES,
    rejectLabelCode,
    TERMINAL_REJECT_LABELS,
} from '@/constants/sumsub-reject-labels.consts'
import en from '../messages/en.json'

const rejectLabels: Record<string, { title: string; description: string }> = en.kyc.rejectLabels

describe('sumsub reject label copy', () => {
    it('has a title and description for every code in the registry', () => {
        for (const code of REJECT_LABEL_CODES) {
            expect(rejectLabels[code]?.title).toBeTruthy()
            expect(rejectLabels[code]?.description).toBeTruthy()
        }
    })

    it('has copy for the fallback code', () => {
        expect(rejectLabels[FALLBACK_REJECT_LABEL_CODE]?.title).toBeTruthy()
        expect(rejectLabels[FALLBACK_REJECT_LABEL_CODE]?.description).toBeTruthy()
    })

    it('carries no catalog entry that the registry does not know about', () => {
        const known = new Set<string>([...REJECT_LABEL_CODES, FALLBACK_REJECT_LABEL_CODE])
        expect(Object.keys(rejectLabels).filter((code) => !known.has(code))).toEqual([])
    })

    it('every terminal label is a known code — a typo there would silently never match', () => {
        const known = new Set<string>(REJECT_LABEL_CODES)
        for (const label of TERMINAL_REJECT_LABELS) {
            expect(known.has(label)).toBe(true)
        }
    })
})

describe('rejectLabelCode', () => {
    it('passes through codes it knows', () => {
        expect(rejectLabelCode('DOCUMENT_EXPIRED')).toBe('DOCUMENT_EXPIRED')
    })

    it('collapses unknown sumsub codes onto the fallback so no key path can render', () => {
        expect(rejectLabelCode('SOME_FUTURE_SUMSUB_CODE')).toBe(FALLBACK_REJECT_LABEL_CODE)
        expect(rejectLabelCode('')).toBe(FALLBACK_REJECT_LABEL_CODE)
    })
})
