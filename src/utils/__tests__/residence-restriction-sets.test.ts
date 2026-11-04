import { getResidenceRestrictionSets, parseResidenceRestrictionSets } from '@/utils/residence-restriction-sets'

const fields = ['full', 'cardOnly', 'bankingOnly', 'refusedIdIssuers', 'bankingNewCustomersOnly'] as const
const valid = () => ({
    full: ['us', 'US'],
    cardOnly: ['gb'],
    bankingOnly: ['ca'],
    refusedIdIssuers: ['fr'],
    bankingNewCustomersOnly: ['de'],
})

describe('parseResidenceRestrictionSets', () => {
    it('normalizes every list into a set, removes duplicates, and leaves input unchanged', () => {
        const input = valid()
        const before = JSON.stringify(input)
        expect(parseResidenceRestrictionSets(input)).toEqual({
            full: new Set(['US']),
            cardOnly: new Set(['GB']),
            bankingOnly: new Set(['CA']),
            refusedIdIssuers: new Set(['FR']),
            bankingNewCustomersOnly: new Set(['DE']),
        })
        expect(JSON.stringify(input)).toBe(before)
    })

    it('accepts five empty lists', () => {
        expect(parseResidenceRestrictionSets(Object.fromEntries(fields.map((field) => [field, []])))).toEqual(
            Object.fromEntries(fields.map((field) => [field, new Set()]))
        )
    })

    it.each([null, undefined, false, 1, 'bad', [], {}])('rejects non-record or incomplete input %p', (input) => {
        expect(parseResidenceRestrictionSets(input)).toBeNull()
    })

    it.each(fields)('rejects a missing %s field', (field) => {
        const input: Partial<ReturnType<typeof valid>> = valid()
        delete input[field]
        expect(parseResidenceRestrictionSets(input)).toBeNull()
    })

    it.each(fields.flatMap((field) => [null, 'US', {}, [1], ['US', null]].map((value) => [field, value] as const)))(
        'rejects malformed %s value %p',
        (field, value) => {
            expect(parseResidenceRestrictionSets({ ...valid(), [field]: value })).toBeNull()
        }
    )

    it('allows a pure memory read before any successful response', () => {
        expect(getResidenceRestrictionSets()).toBeNull()
    })
})
