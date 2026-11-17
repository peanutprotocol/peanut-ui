/** @jest-environment jsdom */
// v7 (TASK-25063): the Landing headline names the inviter when the person arrives through an invite.
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

import { act, screen } from '@testing-library/react'
import { LandingScreen } from '@/components/Setup/redesign/Landing/LandingScreen'
import { EInviteType } from '@/services/services.types'
import { clearInvite, stashAcquisitionInvite, stashInvite } from '@/utils/invite-stash'
import { resetLanding } from './landing-state'
import { loose, msg, renderInShell } from './redesign-harness'
import type { TestLocale } from './redesign-harness'

const headline = () => screen.getByRole('heading', { level: 1 })

beforeEach(() => {
    resetLanding()
    window.localStorage.clear()
})

describe('01 Landing — headline by source', () => {
    it('no source: the default headline', () => {
        renderInShell('landing', <LandingScreen />)
        expect(headline()).toHaveTextContent(loose(msg('setupRedesign.landing.title')))
    })

    it.each(['en', 'es-AR'] as const)(
        'an invite restored from a deferred link: "@<inviter> invited you to Peanut." (%s)',
        (locale: TestLocale) => {
            stashInvite('maria', EInviteType.DIRECT)
            renderInShell('landing', <LandingScreen />, { locale })
            expect(headline()).toHaveTextContent(
                loose(msg('setupRedesign.landing.invitedTitle', { username: 'maria' }, locale))
            )
        }
    )

    it('an invite that lands after the first render (the restore resolves late) updates the headline', () => {
        renderInShell('landing', <LandingScreen />)
        expect(headline()).toHaveTextContent(loose(msg('setupRedesign.landing.title')))
        act(() => stashAcquisitionInvite('creator1'))
        expect(headline()).toHaveTextContent(loose(msg('setupRedesign.landing.invitedTitle', { username: 'creator1' })))
        act(() => clearInvite())
        expect(headline()).toHaveTextContent(loose(msg('setupRedesign.landing.title')))
    })
})
