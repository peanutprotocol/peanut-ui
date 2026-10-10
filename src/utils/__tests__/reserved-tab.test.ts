import { reserveDetachedTab } from '../reserved-tab'

afterEach(() => jest.restoreAllMocks())

describe('reserveDetachedTab', () => {
    it('returns the reserved tab with its opener severed', () => {
        const tab = { opener: {} as unknown, close: jest.fn() }
        jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)

        expect(reserveDetachedTab()).toBe(tab)
        expect(window.open).toHaveBeenCalledWith('', '_blank')
        expect(tab.opener).toBeNull()
    })

    it('returns null when the pop-up is blocked', () => {
        jest.spyOn(window, 'open').mockReturnValue(null)

        expect(reserveDetachedTab()).toBeNull()
    })

    it('closes and discards a tab whose opener cannot be severed', () => {
        const close = jest.fn()
        const tab = {
            close,
            set opener(_value: unknown) {
                throw new DOMException('Blocked a frame from accessing a cross-origin frame.', 'SecurityError')
            },
        }
        jest.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)

        expect(reserveDetachedTab()).toBeNull()
        expect(close).toHaveBeenCalledTimes(1)
    })
})
