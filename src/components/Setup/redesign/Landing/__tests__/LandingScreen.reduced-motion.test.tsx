/** @jest-environment jsdom */
// Contract P1 (01 Landing): reduced motion holds world frame 4 (MOTION.md 5a). Check P1-43.
// framer-motion caches the reduced-motion query on first use, so this check lives in its own file.
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
jest.mock('@/components/Global/PeanutMascot/PeanutMascot.utils', () => require('./motion-clock').clockModule())

import { act, screen } from '@testing-library/react'
import { LandingScreen } from '@/components/Setup/redesign/Landing/LandingScreen'
import { resetLanding } from './landing-state'
import { clock, coinOffsets, setReducedMotionQuery } from './motion-clock'
import { renderInShell } from './redesign-harness'

/** P1-39's coin x at world frame 4 on a 390 phone (band x 0, so translateX = coin x). */
const WF4_STD = [-100.37, 10.93, 122.23, 233.53, 344.83, 456.13]

beforeAll(() => {
    setReducedMotionQuery(true)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})
beforeEach(() => {
    resetLanding()
    clock.tickers.clear()
})

describe('01 Landing — reduced motion', () => {
    it('P1-43 the walker holds world frame 4 for 3 s of clock ticks and the coins sit at their frame-4 places', async () => {
        renderInShell('landing', <LandingScreen />)
        for (let i = 0; i < 90; i++) {
            await act(async () => clock.tickers.forEach((ticker) => ticker(1 / 30)))
        }
        expect(screen.getByTestId('landing-walker')).toHaveAttribute('data-world-frame', '4')
        const offsets = coinOffsets(screen.getByTestId('landing-coin-band')).sort((a, b) => a - b)
        expect(offsets).toHaveLength(WF4_STD.length)
        offsets.forEach((x, i) => expect(Math.abs(x - WF4_STD[i])).toBeLessThanOrEqual(0.01))
    })
})
