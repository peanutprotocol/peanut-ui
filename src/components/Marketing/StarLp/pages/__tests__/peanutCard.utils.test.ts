import { keepTogether } from '../peanutCard.utils'

describe('keepTogether', () => {
    it('joins the phrase with no-break spaces and leaves the rest alone', () => {
        expect(keepTogether('the Peanut Card was built for you.', 'Peanut Card')).toBe(
            'the Peanut Card was built for you.'
        )
    })

    it('returns the text as it was when the phrase is missing', () => {
        expect(keepTogether('Keep it.', 'Peanut Card')).toBe('Keep it.')
    })
})
