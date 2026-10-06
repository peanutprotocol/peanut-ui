import { act, renderHook } from '@testing-library/react'
import {
    __resetOneShotSessionForTests,
    markOneShotStarted,
    recordOneShotIntents,
    useOneShotSession,
} from '@/hooks/useOneShotSession'

const ALL = { qr: true, local: true, card: true, bank: true }

describe('useOneShotSession', () => {
    beforeEach(() => __resetOneShotSessionForTests())
    afterEach(() => __resetOneShotSessionForTests())

    it('holds nothing until the checklist stores a set', () => {
        const { result } = renderHook(() => useOneShotSession())
        expect(result.current).toBeNull()
        act(() => recordOneShotIntents(ALL))
        expect(result.current).toEqual({ intents: ALL, started: false })
    })

    it('reports whether the SDK opened on a stored set, and marks that set started', () => {
        const { result } = renderHook(() => useOneShotSession())
        // no stored set: a legacy start, nothing to mark
        expect(markOneShotStarted()).toBe(false)
        expect(result.current).toBeNull()

        act(() => recordOneShotIntents(ALL))
        let opened = false
        act(() => {
            opened = markOneShotStarted()
        })
        expect(opened).toBe(true)
        expect(result.current).toEqual({ intents: ALL, started: true })
        // a resume opens on the same set
        expect(markOneShotStarted()).toBe(true)
    })

    it('a newly stored set starts over', () => {
        const { result } = renderHook(() => useOneShotSession())
        act(() => recordOneShotIntents(ALL))
        act(() => void markOneShotStarted())
        act(() => recordOneShotIntents({ ...ALL, card: false }))
        expect(result.current).toEqual({ intents: { ...ALL, card: false }, started: false })
    })
})
