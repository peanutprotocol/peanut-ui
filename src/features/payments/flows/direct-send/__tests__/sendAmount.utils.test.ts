import {
    COMMENT_EMOJIS,
    formatSendAmount,
    parseClipboardAmount,
    pickCommentEmojis,
    pressAmountKey,
} from '../sendAmount.utils'

describe('send amount keypad', () => {
    it('keeps cents and never adds a third fractional digit', () => {
        expect(pressAmountKey('', 'decimal')).toBe('0.')
        expect(pressAmountKey('0.', '5')).toBe('0.5')
        expect(pressAmountKey('0.50', '9')).toBe('0.50')
        expect(pressAmountKey('0.50', 'delete')).toBe('0.5')
        expect(pressAmountKey('0.00', '7')).toBe('7')
        expect(formatSendAmount('1250.50')).toBe('$1,250.50')
    })

    it('accepts only a standalone positive USD amount from the clipboard', () => {
        expect(parseClipboardAmount('$1,234.50')).toBe('1234.50')
        expect(parseClipboardAmount('USD 25.5')).toBe('25.5')
        expect(parseClipboardAmount('Dinner 25.50')).toBeNull()
        expect(parseClipboardAmount('0.00')).toBeNull()
        expect(parseClipboardAmount('25.999')).toBeNull()
        expect(parseClipboardAmount('12345678901')).toBeNull()
    })
})

describe('comment emoji suggestions', () => {
    it('chooses three distinct suggestions from the curated list', () => {
        expect(COMMENT_EMOJIS).toHaveLength(18)
        const selected = pickCommentEmojis(() => 0)
        expect(selected).toHaveLength(3)
        expect(new Set(selected).size).toBe(3)
        expect(selected.every((emoji) => COMMENT_EMOJIS.includes(emoji as (typeof COMMENT_EMOJIS)[number]))).toBe(true)
    })
})
