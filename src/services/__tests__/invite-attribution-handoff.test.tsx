/** @jest-environment jsdom */
// The referral hand-off end to end, in the WebView that broke it: every way a
// signup names its inviter must reach POST /invites/accept at registration,
// in a document that loses every cookie the way iOS WKWebView lost the
// session-cookie stash. That loss cost every automatic iOS referral from the
// deferred-link launch until Oct 2026, and nothing failed — unit specs mocked
// the stash and jsdom keeps cookies. Here only the network is mocked.
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { EInviteType } from '@/services/services.types'
import { applyDeferredPayload, iosHandoffString, parseDeferredPayload } from '@/utils/deferred-link'
import {
    readInviteCode,
    readInviteIntent,
    readInviteUserId,
    stashInvite,
    stashAcquisitionInvite,
} from '@/utils/invite-stash'
import { settlePendingInviteAttribution } from '../pending-invite-attribution'

const mockAcceptInvite = jest.fn()
const mockCapture = jest.fn()

jest.mock('../invites', () => ({
    invitesApi: { acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args) },
}))
jest.mock('../invite-acquisition', () => ({
    settleAcceptedInviteAcquisition: () => ({ destination: '/home', pending: [] }),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args), register: jest.fn() },
    capture: (...args: unknown[]) => mockCapture(...args),
}))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('@capacitor/core', () => ({ registerPlugin: jest.fn(() => ({})) }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(() => true),
    getPlatform: jest.fn(() => 'ios'),
    isAndroidNative: jest.fn(() => false),
    isIOSNative: jest.fn(() => true),
    isNativeBridge: jest.fn(() => true),
}))

const ATTRIBUTED = { success: true, attributionResolved: true, onboardingResolved: true, claims: [] }

function loseEveryCookie() {
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: () => {} })
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    loseEveryCookie()
    mockAcceptInvite.mockResolvedValue(ATTRIBUTED)
})
afterEach(() => {
    delete (document as unknown as Record<string, unknown>).cookie
})

describe('invite attribution hand-off in an iOS WebView without cookies', () => {
    it('a passive opening cannot accept an inviter during existing-account hydration', async () => {
        expect(stashAcquisitionInvite('alice')).toBe(true)
        expect(await settlePendingInviteAttribution('existing-account', 'session')).toEqual({ status: 'none' })
        expect(await settlePendingInviteAttribution('existing-account', 'setup_invite_step')).toEqual({
            status: 'none',
        })
        expect(readInviteUserId()).toBe('')
        expect(mockAcceptInvite).not.toHaveBeenCalled()
    })

    it('registration wins an auth-provider race without duplicate acceptance', async () => {
        stashAcquisitionInvite('alice')
        const [session, registration] = await Promise.all([
            settlePendingInviteAttribution('passive-race', 'session'),
            settlePendingInviteAttribution('passive-race', 'registration'),
        ])
        expect(session.status).toBe('none')
        expect(registration.status).toBe('attributed')
        expect(mockAcceptInvite).toHaveBeenCalledTimes(1)
    })

    it('a passive opening cannot overwrite a typed inviter retained after a 503', async () => {
        stashInvite('alice', EInviteType.DIRECT)
        mockAcceptInvite.mockResolvedValueOnce({ success: false, retryable: true, status: 503 })
        await settlePendingInviteAttribution('typed-retry', 'setup_invite_step')
        expect(stashAcquisitionInvite('bob')).toBe(false)
        expect(readInviteCode()).toBe('alice')
        expect(readInviteIntent()).toBe('explicit')
        expect(readInviteUserId()).toBe('typed-retry')
        expect((await settlePendingInviteAttribution('typed-retry', 'session')).status).toBe('attributed')
    })

    it('only the registration-bound account can retry a passive invite after restart', async () => {
        stashAcquisitionInvite('alice')
        mockAcceptInvite.mockResolvedValueOnce({ success: false, retryable: true, status: 503 })
        await settlePendingInviteAttribution('passive-retry', 'registration')
        expect(readInviteIntent()).toBe('acquisition')
        expect(readInviteUserId()).toBe('passive-retry')
        expect(stashAcquisitionInvite('bob')).toBe(false)
        expect((await settlePendingInviteAttribution('other-account', 'session')).status).toBe('account_mismatch')
        await jest.isolateModulesAsync(async () => {
            const fresh = await import('../pending-invite-attribution')
            expect((await fresh.settlePendingInviteAttribution('passive-retry', 'session')).status).toBe('attributed')
        })
        expect(mockAcceptInvite).toHaveBeenCalledTimes(2)
    })

    it('a later explicit choice replaces an unbound passive invite', async () => {
        stashAcquisitionInvite('alice')
        stashInvite('bob', EInviteType.DIRECT)
        expect(readInviteIntent()).toBe('explicit')
        await settlePendingInviteAttribution('explicit-after-passive', 'setup_invite_step')
        expect(mockAcceptInvite).toHaveBeenCalledWith('bob', EInviteType.DIRECT)
    })
    it('a friend’s link restored after the App Store install reaches /invites/accept', async () => {
        // what the store bounce writes to the clipboard, read back on first launch
        const payload = parseDeferredPayload(iosHandoffString('pnutdl=1&invite=Alice&dest=%2Fsetup'))
        expect(payload?.invite).toBe('Alice')
        applyDeferredPayload(payload!)

        const outcome = await settlePendingInviteAttribution('new-user', 'registration')

        expect(mockAcceptInvite).toHaveBeenCalledWith('alice', EInviteType.DIRECT)
        expect(outcome.status).toBe('attributed')
        expect(readInviteCode()).toBe('')
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ATTRIBUTION_SETTLED, {
            trigger: 'registration',
            status: 'attributed',
            invite_type: EInviteType.DIRECT,
        })
    })

    it('an inviter typed on the setup invite step reaches /invites/accept', async () => {
        // the step runs after registration and hands the typed code over the same way
        stashInvite('bob', EInviteType.DIRECT)

        const outcome = await settlePendingInviteAttribution('typed-inviter-user', 'setup_invite_step')

        expect(mockAcceptInvite).toHaveBeenCalledWith('bob', EInviteType.DIRECT)
        expect(outcome.status).toBe('attributed')
        expect(readInviteCode()).toBe('')
    })

    it('an invite link opened in the app (/invite?code=) reaches /invites/accept', async () => {
        // useNativeAppLinks and /setup?code= both stash a bare code as DIRECT
        stashInvite('carol', EInviteType.DIRECT)

        await settlePendingInviteAttribution('invite-link-user', 'registration')

        expect(mockAcceptInvite).toHaveBeenCalledWith('carol', EInviteType.DIRECT)
    })

    it('the invite survives the app being killed between first launch and registration', async () => {
        applyDeferredPayload({ invite: 'alice' })

        // a fresh JS context: nothing in module memory carries the invite over
        await jest.isolateModulesAsync(async () => {
            const { settlePendingInviteAttribution: settleAfterRestart } = await import('../pending-invite-attribution')
            await settleAfterRestart('new-user', 'registration')
        })

        expect(mockAcceptInvite).toHaveBeenCalledWith('alice', EInviteType.DIRECT)
    })

    it('a registration with no inviter reports `none` instead of leaving no trace', async () => {
        const outcome = await settlePendingInviteAttribution('user-without-invite', 'registration')

        expect(outcome.status).toBe('none')
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ATTRIBUTION_SETTLED, {
            trigger: 'registration',
            status: 'none',
        })
    })

    it('an app start with no inviter reports nothing — it is every launch', async () => {
        await settlePendingInviteAttribution('returning-user', 'session')

        expect(mockCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ATTRIBUTION_SETTLED, expect.anything())
    })
})
