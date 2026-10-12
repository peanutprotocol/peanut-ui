/**
 * The first-launch intro hero with the real framer-motion (SetupWrapper.test.tsx
 * mocks it). Release 164 shipped a hero stuck at 40% under the full-screen intro
 * art, because framer-motion dropped the hero's first height target.
 */
import React from 'react'
import { act } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupWrapper } from '../SetupWrapper'

jest.mock('framer-motion', () => ({
    ...jest.requireActual('framer-motion'),
    // Zero-length transitions, so each target lands on the next frame.
    useReducedMotion: () => true,
}))
jest.mock('@/i18n/app/locale-context', () => ({ useAppLocale: () => ({ locale: 'en', setLocale: jest.fn() }) }))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => false }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@/utils/capacitor', () => ({ isNativeBridge: () => false, isCapacitor: () => false }))
jest.mock('@/components/0_Bruddle/CloudsBackground', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: () => <div data-testid="mascot" />,
}))
jest.mock('../OnboardingAnimation', () => ({ __esModule: true, default: () => null }))

const VIEWPORT_HEIGHT = 667

describe('First-launch intro hero', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT_HEIGHT })
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    })
    afterEach(() => jest.useRealTimers())

    it('fills the screen while the greeting shows', async () => {
        const { container } = renderWithIntl(
            <SetupWrapper
                layoutType="signup"
                screenId="landing"
                image={{ pose: 'waving-chill' }}
                firstLaunchIntroPreview="still"
            >
                <button type="button">Sign up</button>
            </SetupWrapper>
        )
        await act(async () => {
            await Promise.resolve()
        })
        // The mascot-ready fallback, then the greeting delay.
        await act(async () => {
            jest.advanceTimersByTime(1_500)
        })
        await act(async () => {
            jest.advanceTimersByTime(700)
        })

        expect(container.querySelector('[role="status"]')).toHaveTextContent('Hey, I’m Peanut')
        const hero = container.querySelector<HTMLElement>('[data-setup-hero]')!
        // The resting class would hold the hero at 40dvh behind the intro art.
        expect(hero).not.toHaveClass('setup-hero-height')
        expect(hero.style.height).toBe(`${VIEWPORT_HEIGHT}px`)
    })
})
