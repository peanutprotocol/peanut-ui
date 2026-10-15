/** @jest-environment jsdom */
// The referral hand-off end to end, in the WebView that broke it: every way a
// signup names its inviter must reach POST /invites/accept at registration,
// in a document that loses every cookie the way iOS WKWebView lost the
// session-cookie stash. That loss cost every automatic iOS referral from the
// deferred-link launch until Oct 2026, and nothing failed — unit specs mocked
// the stash and jsdom keeps cookies. Here only the network is mocked.
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { EInviteType } from '@/services/services.types'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { applyDeferredPayload, iosHandoffString, parseDeferredPayload } from '@/utils/deferred-link'
import { readInviteCode, stashInvite } from '@/utils/invite-stash'
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

    it('an inviter typed on the invite step reaches /invites/accept', async () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <SetupFlowProvider masterScreenIds={[]}>{children}</SetupFlowProvider>
        )
        const { result } = renderHook(() => useSetupFlowContext(), { wrapper })
        act(() => result.current.applyManualInvite('bob'))

        await settlePendingInviteAttribution('new-user', 'registration')

        expect(mockAcceptInvite).toHaveBeenCalledWith('bob', EInviteType.DIRECT)
    })

    it('an invite link opened in the app (/invite?code=) reaches /invites/accept', async () => {
        // useNativeAppLinks and /setup?code= both stash a bare code as DIRECT
        stashInvite('carol', EInviteType.DIRECT)

        await settlePendingInviteAttribution('new-user', 'registration')

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
        const outcome = await settlePendingInviteAttribution('new-user', 'registration')

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
