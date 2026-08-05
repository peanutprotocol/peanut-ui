import { countReviewed, parseCopyReviewState, serializeCopyReviewState, toggleCopyReview } from '../copyReviewStorage'

describe('copyReviewStorage', () => {
    it('treats missing or unreadable storage as "nothing reviewed"', () => {
        expect(parseCopyReviewState(null)).toEqual({})
        expect(parseCopyReviewState('')).toEqual({})
        expect(parseCopyReviewState('not json')).toEqual({})
        expect(parseCopyReviewState('["lifecycle.fund_1#0"]')).toEqual({})
        expect(parseCopyReviewState('null')).toEqual({})
    })

    it('keeps only entries explicitly marked reviewed', () => {
        expect(parseCopyReviewState('{"a#0":true,"b#0":false,"c#0":"yes","d#0":1}')).toEqual({ 'a#0': true })
    })

    it('round-trips through serialize', () => {
        const state = toggleCopyReview({}, 'lifecycle.welcome#0')
        expect(parseCopyReviewState(serializeCopyReviewState(state))).toEqual(state)
    })

    it('toggles a verdict on and back off without mutating the input', () => {
        const empty = {}
        const on = toggleCopyReview(empty, 'lifecycle.verify_1#0')
        expect(on).toEqual({ 'lifecycle.verify_1#0': true })
        expect(empty).toEqual({})

        const off = toggleCopyReview(on, 'lifecycle.verify_1#0')
        expect(off).toEqual({})
        expect(on).toEqual({ 'lifecycle.verify_1#0': true })
    })

    it('counts the two first_spend examples independently', () => {
        const state = toggleCopyReview({}, 'lifecycle.first_spend_1#1')
        expect(countReviewed(state, ['lifecycle.first_spend_1#0', 'lifecycle.first_spend_1#1'])).toBe(1)
    })

    it('ignores verdicts for renders that no longer exist on the board', () => {
        const state = { 'lifecycle.removed_email#0': true as const, 'lifecycle.welcome#0': true as const }
        expect(countReviewed(state, ['lifecycle.welcome#0'])).toBe(1)
    })
})
