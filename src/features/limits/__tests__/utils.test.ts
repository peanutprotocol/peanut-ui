import { getLimitColorClass } from '../utils'

describe('limit attention colors', () => {
    test.each([21, 50, 70])('%s percent remaining uses a readable attention foreground', (remaining) => {
        expect(getLimitColorClass(remaining, 'text')).toBe('text-foreground-attention')
    })
    test.each([21, 50, 70])('%s percent remaining keeps the yellow progress fill', (remaining) => {
        expect(getLimitColorClass(remaining, 'bg')).toBe('bg-background-accent-yellow')
    })
})
