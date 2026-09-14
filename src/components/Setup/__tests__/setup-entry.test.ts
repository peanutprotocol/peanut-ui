/** @jest-environment jsdom */
import { hasKnownDeviceCredentials, resolveSetupEntryStep, type SetupEntryInput } from '../setup-entry'

const base: SetupEntryInput = {
    hasInviteCode: false,
    stepParam: null,
    webSignupClosed: false,
    knownDevice: false,
}

describe('resolveSetupEntryStep', () => {
    describe('known device (passkey credentials, no session) always lands on Log In', () => {
        it.each([
            ['plain entry', {}],
            ['invite code', { hasInviteCode: true }],
            ['?step=signup', { stepParam: 'signup' }],
        ])('%s', (_name, overrides) => {
            expect(resolveSetupEntryStep({ ...base, ...overrides, knownDevice: true })).toBe('landing')
        })
    })

    describe('?step=login', () => {
        it('lands on Log In even with an invite code', () => {
            expect(resolveSetupEntryStep({ ...base, stepParam: 'login', hasInviteCode: true })).toBe('landing')
        })
    })

    describe('app entry', () => {
        it('lands on landing by default', () => {
            expect(resolveSetupEntryStep(base)).toBe('landing')
        })

        it.each([
            ['invite code', { hasInviteCode: true }],
            ['?step=signup', { stepParam: 'signup' }],
        ])('skips the invite gate with %s', (_name, overrides) => {
            expect(resolveSetupEntryStep({ ...base, ...overrides })).toBe('signup')
        })

        it('does not skip the landing gate while web signups are closed', () => {
            expect(
                resolveSetupEntryStep({
                    ...base,
                    hasInviteCode: true,
                    webSignupClosed: true,
                })
            ).toBe('landing')
            expect(resolveSetupEntryStep({ ...base, stepParam: 'signup', webSignupClosed: true })).toBe('landing')
        })

        it('an unknown ?step value changes nothing', () => {
            expect(resolveSetupEntryStep({ ...base, stepParam: 'residence' })).toBe('landing')
        })
    })
})

describe('hasKnownDeviceCredentials', () => {
    const clearCookies = () => {
        for (const entry of document.cookie.split(';')) {
            const name = entry.trim().split('=')[0]
            if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
        }
    }

    beforeEach(() => {
        clearCookies()
        localStorage.clear()
    })

    it('is false on a fresh device', () => {
        expect(hasKnownDeviceCredentials()).toBe(false)
    })

    it('is true when the web-authn-key cookie is set', () => {
        document.cookie = `web-authn-key=${encodeURIComponent(JSON.stringify({ authenticatorId: 'abc' }))}; path=/`
        expect(hasKnownDeviceCredentials()).toBe(true)
    })

    it('ignores an emptied web-authn-key cookie', () => {
        document.cookie = 'web-authn-key=; path=/'
        expect(hasKnownDeviceCredentials()).toBe(false)
    })

    it('is true when a user-preferences entry carries a webAuthnKey', () => {
        localStorage.setItem('u-123:user-preferences', JSON.stringify({ webAuthnKey: { authenticatorId: 'abc' } }))
        expect(hasKnownDeviceCredentials()).toBe(true)
    })

    it('ignores user-preferences without a key and unrelated entries', () => {
        localStorage.setItem('u-123:user-preferences', JSON.stringify({ balanceHidden: true }))
        localStorage.setItem('u-456:user-preferences', JSON.stringify({ webAuthnKey: undefined }))
        localStorage.setItem('web-authn-key', 'not-a-preferences-entry')
        expect(hasKnownDeviceCredentials()).toBe(false)
    })

    it('survives a malformed preferences entry', () => {
        localStorage.setItem('u-123:user-preferences', '{not json')
        expect(hasKnownDeviceCredentials()).toBe(false)
    })
})
