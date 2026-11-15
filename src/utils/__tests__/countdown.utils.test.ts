import { countdownLabel } from '../countdown.utils'

describe('countdownLabel', () => {
    it('shows minutes and padded seconds, and nothing once time is up', () => {
        expect(countdownLabel(9 * 60_000 + 5_000)).toBe('9:05')
        expect(countdownLabel(59_999)).toBe('0:59')
        expect(countdownLabel(0)).toBeNull()
        expect(countdownLabel(-1)).toBeNull()
        expect(countdownLabel(Number.NaN)).toBeNull()
    })
})
