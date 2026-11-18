/** @jest-environment jsdom */
// Contract P1 (01 Landing): the X1 walk under normal motion, driven by a hand-stepped mascot clock. Checks P1-44, P1-45.
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

const tick = async (seconds: number) => {
    await act(async () => {
        clock.tickers.forEach((ticker) => ticker(seconds))
    })
}
const shownFrame = () => Number(screen.getByTestId('landing-walker').getAttribute('data-world-frame'))
const coinBoxes = () =>
    Array.from(screen.getByTestId('landing-coin-band').querySelectorAll<HTMLElement>('[style*="translate"]')).map(
        (coin) => ({ left: coin.style.left, top: coin.style.top, width: coin.style.width })
    )

beforeAll(() => {
    setReducedMotionQuery(false)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})
beforeEach(() => {
    resetLanding()
    clock.tickers.clear()
})

describe('01 Landing — the X1 walk (MOTION.md 5a)', () => {
    it('P1-44 after 1 s of clock ticks the world frame is even, past 4, and only ever stepped by 2; coins move by translateX only', async () => {
        renderInShell('landing', <LandingScreen />)
        expect(clock.tickers.size).toBeGreaterThan(0)
        expect(shownFrame()).toBe(4)
        const boxesBefore = coinBoxes()
        expect(boxesBefore.length).toBeGreaterThanOrEqual(6)

        const seen = [shownFrame()]
        for (let i = 0; i < 30; i++) {
            await tick(1 / 30)
            seen.push(shownFrame())
        }
        const last = seen[seen.length - 1]
        expect(last).toBeGreaterThan(4)
        for (const frame of seen) expect(frame % 2).toBe(0)
        for (let i = 1; i < seen.length; i++) expect([0, 2]).toContain(seen[i] - seen[i - 1])

        const band = screen.getByTestId('landing-coin-band')
        for (const coin of Array.from(band.querySelectorAll<HTMLElement>('[style*="translate"]'))) {
            expect(coin.style.transform).toMatch(/^translateX\(-?[\d.]+px\)$/)
        }
        expect(coinOffsets(band).every(Number.isFinite)).toBe(true)
        expect(coinBoxes()).toEqual(boxesBefore)
    })

    it('P1-45 unmount stops the walk: the clock subscription is released and no tick reaches the walker afterwards', async () => {
        const view = renderInShell('landing', <LandingScreen />)
        await tick(0.1)
        const before = Array.from(clock.tickers)
        expect(before.length).toBeGreaterThan(0)

        view.unmount()
        expect(clock.tickers.size).toBe(0)
        // A late callback from the old subscription must not throw or update an unmounted tree.
        const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
        await act(async () => before.forEach((ticker) => ticker(0.1)))
        expect(errors).not.toHaveBeenCalled()
        errors.mockRestore()
    })
})
