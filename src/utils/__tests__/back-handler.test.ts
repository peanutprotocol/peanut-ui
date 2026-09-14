import { dispatchBackPress, registerBackHandler, resetBackHandlersForTests } from '@/utils/back-handler'

describe('back-handler stack', () => {
    beforeEach(() => {
        resetBackHandlersForTests()
        jest.restoreAllMocks()
    })

    it('returns false with no handlers registered', () => {
        expect(dispatchBackPress()).toBe(false)
    })

    it('dispatches to the most recently registered handler first (LIFO)', () => {
        const calls: string[] = []
        registerBackHandler(() => {
            calls.push('first')
            return true
        })
        registerBackHandler(() => {
            calls.push('second')
            return true
        })

        expect(dispatchBackPress()).toBe(true)
        expect(calls).toEqual(['second'])
    })

    it('falls through handlers that return false', () => {
        const calls: string[] = []
        registerBackHandler(() => {
            calls.push('bottom')
            return true
        })
        registerBackHandler(() => {
            calls.push('middle')
            return false
        })
        registerBackHandler(() => {
            calls.push('top')
            return false
        })

        expect(dispatchBackPress()).toBe(true)
        expect(calls).toEqual(['top', 'middle', 'bottom'])
    })

    it('returns false when every handler declines', () => {
        registerBackHandler(() => false)
        registerBackHandler(() => false)
        expect(dispatchBackPress()).toBe(false)
    })

    it('unregisters from the middle of the stack without disturbing the others', () => {
        const calls: string[] = []
        registerBackHandler(() => {
            calls.push('bottom')
            return true
        })
        const unregisterMiddle = registerBackHandler(() => {
            calls.push('middle')
            return true
        })
        registerBackHandler(() => {
            calls.push('top')
            return false
        })

        unregisterMiddle()
        expect(dispatchBackPress()).toBe(true)
        expect(calls).toEqual(['top', 'bottom'])
    })

    it('re-registering a handler moves it to the top', () => {
        const calls: string[] = []
        const a = () => {
            calls.push('a')
            return true
        }
        const unregisterA = registerBackHandler(a)
        registerBackHandler(() => {
            calls.push('b')
            return true
        })

        unregisterA()
        registerBackHandler(a)

        expect(dispatchBackPress()).toBe(true)
        expect(calls).toEqual(['a'])
    })

    it('unregister is idempotent and only removes its own registration', () => {
        const handler = jest.fn(() => true)
        const first = registerBackHandler(handler)
        registerBackHandler(handler)

        first()
        first()
        expect(dispatchBackPress()).toBe(true)
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('skips a throwing handler and keeps walking the stack', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        const below = jest.fn(() => true)
        registerBackHandler(below)
        registerBackHandler(() => {
            throw new Error('boom')
        })

        expect(dispatchBackPress()).toBe(true)
        expect(below).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalled()
    })

    it('resetBackHandlersForTests empties the stack', () => {
        registerBackHandler(() => true)
        resetBackHandlersForTests()
        expect(dispatchBackPress()).toBe(false)
    })
})
