/** @jest-environment jsdom */
// v7 (TASK-25063): the Landing headline names the inviter when the person arrives through an invite; organic
// installs read the trust line under the default headline (addendum 1). The stashed code is never shown as is:
// only a code the API confirms names the inviter, with the username the API returns (Kush review, 2026-11-18).
jest.mock('@/hooks/useLogin', () => require('./landing-state').useLoginModule())
jest.mock('@/hooks/useSetupFlow', () => require('./landing-state').useSetupFlowModule())
jest.mock('@/features/setup/SetupFlowContext', () => require('./landing-state').setupFlowContextModule())
jest.mock('@/features/setup/signup-draft', () => require('./landing-state').signupDraftModule())
jest.mock('@/utils/capacitor', () => require('./landing-state').capacitorModule())
jest.mock('@/utils/native-platform', () => require('./landing-state').nativePlatformModule())
jest.mock('@/hooks/useGetDeviceType', () => require('./landing-state').deviceTypeModule())
jest.mock('@/hooks/useKeepWebBypass', () => require('./landing-state').keepWebModule())
jest.mock('@/constants/migration.consts', () => require('./landing-state').migrationModule())
jest.mock('@/components/Migration/StoreButtons', () => require('./landing-state').storeButtonsModule())
jest.mock('@/components/0_Bruddle/Toast', () => require('./landing-state').toastModule())
jest.mock('@sentry/nextjs', () => require('./landing-state').sentryModule())
jest.mock('@/utils/sentry-lazy', () => require('./landing-state').sentryModule())
jest.mock('posthog-js', () => require('./landing-state').posthogModule())
jest.mock('lottie-web/build/player/lottie_light', () => require('./landing-state').lottieModule())
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () =>
    require('./landing-state').languageSwitcherModule()
)
jest.mock('@/services/invites', () => ({
    ...jest.requireActual('@/services/invites'),
    invitesApi: { validateInviteCode: jest.fn() },
}))

import { act, screen, waitFor } from '@testing-library/react'
import { LandingScreen } from '@/components/Setup/redesign/Landing/LandingScreen'
import { invitesApi } from '@/services/invites'
import { EInviteType } from '@/services/services.types'
import { clearInvite, stashAcquisitionInvite, stashInvite } from '@/utils/invite-stash'
import { resetLanding } from './landing-state'
import { loose, msg, renderInShell } from './redesign-harness'
import type { TestLocale } from './redesign-harness'

const headline = () => screen.getByRole('heading', { level: 1 })
const trustLine = () => document.querySelector('[data-setup-subtitle]')
const validate = invitesApi.validateInviteCode as jest.Mock
const found = (username: string) => ({ success: true, attributionResolved: true, onboardingResolved: true, username })
const defaultHeadline = (locale: TestLocale = 'en') => {
    expect(headline()).toHaveTextContent(loose(msg('setupRedesign.landing.title', {}, locale)))
    expect(trustLine()).toHaveTextContent(loose(msg('setupRedesign.landing.trustLine', {}, locale)))
}

beforeEach(() => {
    resetLanding()
    window.localStorage.clear()
    validate.mockReset()
})

describe('01 Landing — headline by source', () => {
    it.each(['en', 'es-AR'] as const)(
        'no source: the default headline with the trust line under it, in the headline block (%s)',
        (locale: TestLocale) => {
            renderInShell('landing', <LandingScreen />, { locale })
            expect(headline()).toHaveTextContent(loose(msg('setupRedesign.landing.title', {}, locale)))
            expect(trustLine()).toHaveTextContent(loose(msg('setupRedesign.landing.trustLine', {}, locale)))
            // the art scale measures this block, so the art never covers the line
            expect(trustLine()?.parentElement).toBe(headline().parentElement)
            expect(trustLine()?.querySelector('svg, img')).toBeNull()
        }
    )

    it.each(['en', 'es-AR'] as const)(
        'a confirmed invite: "Invited by @<inviter>." with the username the API returns, no trust line (%s)',
        async (locale: TestLocale) => {
            stashInvite('MARIA-CODE', EInviteType.DIRECT)
            validate.mockResolvedValue(found('maria'))
            renderInShell('landing', <LandingScreen />, { locale })
            await waitFor(() =>
                expect(headline()).toHaveTextContent(
                    loose(msg('setupRedesign.landing.invitedTitle', { username: 'maria' }, locale))
                )
            )
            expect(trustLine()).toBeNull()
            // the service normalises the code (toInviteCode) before the API call
            expect(validate).toHaveBeenCalledWith('MARIA-CODE')
            expect(document.body).not.toHaveTextContent(/maria-code/i)
        }
    )

    it('while the check runs: the default headline and trust line, never the raw code', () => {
        stashInvite('anything at all', EInviteType.DIRECT)
        validate.mockReturnValue(new Promise(() => {}))
        renderInShell('landing', <LandingScreen />)
        defaultHeadline()
        expect(document.body).not.toHaveTextContent(/anything at all/i)
    })

    it.each([
        [
            'an unknown code',
            { success: false, notFound: true, attributionResolved: false, onboardingResolved: false, username: '' },
        ],
        [
            'a code with no inviter (campaign only)',
            { success: true, attributionResolved: false, onboardingResolved: false, username: '' },
        ],
    ])('%s: the default headline and trust line, never the raw code', async (_case, result) => {
        stashInvite('squirrelinvitesyou', EInviteType.DIRECT)
        validate.mockResolvedValue(result)
        renderInShell('landing', <LandingScreen />)
        await waitFor(() => expect(validate).toHaveBeenCalled())
        await act(async () => {})
        defaultHeadline()
        expect(document.body).not.toHaveTextContent(/squirrelinvitesyou/i)
    })

    it('a failed check: the default headline and trust line', async () => {
        stashInvite('maria', EInviteType.DIRECT)
        validate.mockRejectedValue(new Error('network'))
        renderInShell('landing', <LandingScreen />)
        await waitFor(() => expect(validate).toHaveBeenCalled())
        await act(async () => {})
        defaultHeadline()
    })

    it('an invite that lands after the first render (the restore resolves late) updates the headline', async () => {
        validate.mockResolvedValue(found('creator1'))
        renderInShell('landing', <LandingScreen />)
        defaultHeadline()
        expect(validate).not.toHaveBeenCalled()
        act(() => stashAcquisitionInvite('creator1'))
        await waitFor(() =>
            expect(headline()).toHaveTextContent(
                loose(msg('setupRedesign.landing.invitedTitle', { username: 'creator1' }))
            )
        )
        act(() => clearInvite())
        defaultHeadline()
    })
})
