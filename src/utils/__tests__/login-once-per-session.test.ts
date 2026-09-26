import type { CaptureResult } from 'posthog-js'
import { suppressDuplicateLogin } from '../login-once-per-session'

const STORAGE_KEY = 'ph_login_captured_session'

function loginEvent(sessionId?: string): CaptureResult {
    return {
        event: 'login',
        properties: sessionId ? { $session_id: sessionId } : {},
    } as unknown as CaptureResult
}

describe('suppressDuplicateLogin (TASK-22516)', () => {
    beforeEach(() => window.localStorage.clear())

    it('passes non-login events through untouched', () => {
        const ev = { event: '$pageview', properties: { $session_id: 's1' } } as unknown as CaptureResult
        expect(suppressDuplicateLogin(ev)).toBe(ev)
        expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('lets the first login of a session through and drops repeats', () => {
        const first = loginEvent('s1')
        expect(suppressDuplicateLogin(first)).toBe(first)
        expect(suppressDuplicateLogin(loginEvent('s1'))).toBeNull()
    })

    it('survives a reload: the marker is persisted, not module state', () => {
        window.localStorage.setItem(STORAGE_KEY, 's1') // marker from the "previous page load"
        expect(suppressDuplicateLogin(loginEvent('s1'))).toBeNull()
    })

    it('captures again when the session rotates (idle-resume assigns a new id)', () => {
        expect(suppressDuplicateLogin(loginEvent('s1'))).not.toBeNull()
        const resumed = loginEvent('s2')
        expect(suppressDuplicateLogin(resumed)).toBe(resumed)
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe('s2')
    })

    it('fails open when the event carries no $session_id', () => {
        const ev = loginEvent()
        expect(suppressDuplicateLogin(ev)).toBe(ev)
        expect(suppressDuplicateLogin(loginEvent())).not.toBeNull()
    })

    it('fails open when storage throws', () => {
        const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('private mode')
        })
        try {
            const ev = loginEvent('s1')
            expect(suppressDuplicateLogin(ev)).toBe(ev)
        } finally {
            spy.mockRestore()
        }
    })

    it('passes null through (upstream drop already happened)', () => {
        expect(suppressDuplicateLogin(null)).toBeNull()
    })
})
