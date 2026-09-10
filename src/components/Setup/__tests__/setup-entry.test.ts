/** @jest-environment jsdom */
import { DeviceType } from '@/hooks/useGetDeviceType'
import { hasKnownDeviceCredentials, resolveSetupEntryStep, type SetupEntryInput } from '../setup-entry'

const base: SetupEntryInput = {
    isCapacitor: false,
    deviceType: DeviceType.WEB,
    isStandalonePWA: false,
    hasInviteCode: false,
    stepParam: null,
    webSignupClosed: false,
    knownDevice: false,
}

describe('resolveSetupEntryStep', () => {
    describe('known device (passkey credentials, no session) always lands on Log In', () => {
        it.each([
            ['capacitor + invite code', { isCapacitor: true, hasInviteCode: true }],
            ['capacitor + ?step=signup', { isCapacitor: true, stepParam: 'signup' }],
            ['desktop web', {}],
            ['desktop web + invite code', { hasInviteCode: true }],
            ['android browser (not installed)', { deviceType: DeviceType.ANDROID }],
            [
                'android PWA + ?step=signup',
                { deviceType: DeviceType.ANDROID, isStandalonePWA: true, stepParam: 'signup' },
            ],
            ['ios', { deviceType: DeviceType.IOS, hasInviteCode: true }],
        ])('%s', (_name, overrides) => {
            expect(resolveSetupEntryStep({ ...base, ...overrides, knownDevice: true })).toBe('landing')
        })
    })

    describe('?step=login', () => {
        it.each([
            ['capacitor', { isCapacitor: true }],
            ['desktop web', {}],
            ['android browser', { deviceType: DeviceType.ANDROID }],
        ])('lands on Log In on %s, even with an invite code', (_name, overrides) => {
            expect(resolveSetupEntryStep({ ...base, ...overrides, stepParam: 'login', hasInviteCode: true })).toBe(
                'landing'
            )
        })
    })

    describe('capacitor', () => {
        it('lands on landing by default', () => {
            expect(resolveSetupEntryStep({ ...base, isCapacitor: true })).toBe('landing')
        })

        it.each([
            ['invite code', { hasInviteCode: true }],
            ['?step=signup', { stepParam: 'signup' }],
        ])('skips the invite gate with %s', (_name, overrides) => {
            expect(resolveSetupEntryStep({ ...base, isCapacitor: true, ...overrides })).toBe('signup')
        })
    })

    describe('web', () => {
        it('desktop → pwa-install', () => {
            expect(resolveSetupEntryStep(base)).toBe('pwa-install')
        })

        it('android browser → android-initial-pwa-install', () => {
            expect(resolveSetupEntryStep({ ...base, deviceType: DeviceType.ANDROID })).toBe(
                'android-initial-pwa-install'
            )
        })

        it('android installed PWA → landing', () => {
            expect(resolveSetupEntryStep({ ...base, deviceType: DeviceType.ANDROID, isStandalonePWA: true })).toBe(
                'landing'
            )
        })

        it('ios → landing', () => {
            expect(resolveSetupEntryStep({ ...base, deviceType: DeviceType.IOS })).toBe('landing')
        })

        it.each([
            ['invite code', { hasInviteCode: true }],
            ['?step=signup', { stepParam: 'signup' }],
        ])('%s skips the invite gate on every device', (_name, overrides) => {
            for (const deviceType of [DeviceType.WEB, DeviceType.ANDROID, DeviceType.IOS]) {
                expect(resolveSetupEntryStep({ ...base, deviceType, ...overrides })).toBe('signup')
            }
        })

        it('does not skip the landing gate while web signups are closed', () => {
            expect(
                resolveSetupEntryStep({
                    ...base,
                    deviceType: DeviceType.IOS,
                    hasInviteCode: true,
                    webSignupClosed: true,
                })
            ).toBe('landing')
            expect(resolveSetupEntryStep({ ...base, stepParam: 'signup', webSignupClosed: true })).toBe('pwa-install')
        })

        it('an unknown ?step value changes nothing', () => {
            expect(resolveSetupEntryStep({ ...base, stepParam: 'residence' })).toBe('pwa-install')
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
