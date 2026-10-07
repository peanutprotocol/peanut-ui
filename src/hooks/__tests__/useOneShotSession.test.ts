import { act, renderHook } from '@testing-library/react'
import {
    __resetOneShotSessionForTests,
    markOneShotStarted,
    newestIntentSet,
    readOneShotSession,
    recordOneShotIntents,
    useOneShotSession,
} from '@/hooks/useOneShotSession'

const ALL = { qr: true, local: true, card: true, bank: true }
const QR = { qr: true, local: false, card: false, bank: false }
const EARLIER = '2026-10-07T09:00:00.000Z'
const LATER = '2026-10-07T10:00:00.000Z'

describe('useOneShotSession', () => {
    beforeEach(() => __resetOneShotSessionForTests())
    afterEach(() => __resetOneShotSessionForTests())

    it('holds nothing until the checklist stores a set', () => {
        const { result } = renderHook(() => useOneShotSession())
        expect(result.current).toBeNull()
        act(() => recordOneShotIntents(ALL, LATER))
        expect(result.current).toEqual({ intents: ALL, setAt: LATER, started: false })
        expect(readOneShotSession()).toEqual(result.current)
    })

    it('reports whether the SDK opened on a stored set, and marks that set started', () => {
        const { result } = renderHook(() => useOneShotSession())
        // no stored set: a legacy start, nothing to mark
        expect(markOneShotStarted()).toBe(false)
        expect(result.current).toBeNull()

        act(() => recordOneShotIntents(ALL, LATER))
        let opened = false
        act(() => {
            opened = markOneShotStarted()
        })
        expect(opened).toBe(true)
        expect(result.current).toEqual({ intents: ALL, setAt: LATER, started: true })
        // a resume opens on the same set
        expect(markOneShotStarted()).toBe(true)
    })

    it('a newly stored set starts over', () => {
        const { result } = renderHook(() => useOneShotSession())
        act(() => recordOneShotIntents(ALL, LATER))
        act(() => void markOneShotStarted())
        act(() => recordOneShotIntents({ ...ALL, card: false }, LATER))
        expect(result.current).toEqual({ intents: { ...ALL, card: false }, setAt: LATER, started: false })
    })
})

// the server's set outranks the tab's, except when the tab's is newer: a
// /users/me answered from a replica behind the save must not hide the save
describe('newestIntentSet', () => {
    const tab = { intents: ALL, setAt: LATER, started: false }

    it('is null with nothing stored anywhere', () => {
        expect(newestIntentSet(null, null, null)).toBeNull()
        expect(newestIntentSet(undefined, undefined, null)).toBeNull()
    })

    it("is the tab's set until /users/me carries one", () => {
        expect(newestIntentSet(null, null, tab)).toEqual(ALL)
    })

    it("is the server's set when the tab stored nothing, or when the server's is as new", () => {
        expect(newestIntentSet(QR, EARLIER, null)).toEqual(QR)
        expect(newestIntentSet(QR, LATER, tab)).toEqual(QR)
        expect(newestIntentSet(QR, '2026-10-07T11:00:00.000Z', tab)).toEqual(QR)
    })

    it("is the tab's set when /users/me is behind the save", () => {
        expect(newestIntentSet(QR, EARLIER, tab)).toEqual(ALL)
    })

    it("is the server's set when it carries no date (an older API)", () => {
        expect(newestIntentSet(QR, null, tab)).toEqual(QR)
    })
})
