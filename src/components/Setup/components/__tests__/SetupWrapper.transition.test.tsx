import React from 'react'
import { act, cleanup, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupWrapper } from '../SetupWrapper'
import { frameData, frameSteps, MotionGlobalConfig, time } from 'framer-motion'

jest.mock('@/i18n/app/locale-context', () => ({ useAppLocale: () => ({ locale: 'en', setLocale: jest.fn() }) }))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => false }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/components/0_Bruddle/CloudsBackground', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: () => <div data-testid="card-illustration" />,
}))
jest.mock('../OnboardingAnimation', () => ({ __esModule: true, default: () => null }))
// Keep real AnimatePresence and motion: this catches an outgoing header losing its hero.
jest.mock('framer-motion', () => ({ ...jest.requireActual('framer-motion'), useReducedMotion: () => false }))

beforeEach(() => {
    MotionGlobalConfig.useManualTiming = true
    frameData.timestamp = 0
    time.set(0)
})
afterEach(() => {
    cleanup()
    MotionGlobalConfig.useManualTiming = false
})

// Drive real Motion frames instead of racing requestAnimationFrame against waitFor's timeout.
async function finishTransition() {
    for (let frame = 0; frame < 60; frame++) {
        await act(async () => {
            frameData.delta = 1000 / 60
            frameData.timestamp += frameData.delta
            frameData.isProcessing = true
            time.set(frameData.timestamp)
            for (const step of Object.values(frameSteps)) step.process(frameData)
            frameData.isProcessing = false
        })
    }
}

it('slides the panels with only the incoming one accessible; the hero is not part of the slide', async () => {
    const view = renderWithIntl(
        <SetupWrapper layoutType="signup" screenId="advantage-card" image={{ pose: 'thinking' }} title="Pink card">
            <button>Next</button>
        </SetupWrapper>
    )
    const hero = screen.getByTestId('card-illustration').closest('.setup-hero-background')
    view.rerender(
        <SetupWrapper layoutType="signup" screenId="advantage-bank" fullScreen>
            <h1>Fund your account</h1>
        </SetupWrapper>
    )
    expect(screen.getByText(/^Pink card/)).toBeInTheDocument()
    // A full-page step has no hero; the hero is outside the sliding panels, so it goes at once.
    expect(hero).not.toBeInTheDocument()
    expect(screen.getByText('Fund your account')).toBeInTheDocument()
    const outgoing = screen.getByText(/^Pink card/).closest('[aria-hidden="true"]')
    expect(outgoing).toHaveAttribute('aria-hidden', 'true')
    expect(outgoing).toHaveAttribute('inert')
    expect(outgoing).toHaveClass('absolute', 'inset-0')
    expect(screen.getByText('Fund your account').closest('[aria-hidden="false"]')).not.toHaveClass('absolute')
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    await finishTransition()
    expect(screen.queryByText(/^Pink card/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
})

it('keeps one hero mounted between steps while its art moves and fades', async () => {
    const view = renderWithIntl(
        <SetupWrapper layoutType="signup" screenId="advantage-card" image={{ pose: 'thinking' }} title="Pink card">
            <button>Next</button>
        </SetupWrapper>
    )
    const hero = screen.getByTestId('card-illustration').closest('.setup-hero-background')
    view.rerender(
        <SetupWrapper layoutType="signup" screenId="advantage-fees" image={{ pose: 'cheering' }} title="Accounts">
            <button>Next</button>
        </SetupWrapper>
    )
    expect(document.querySelectorAll('.setup-hero-background')).toHaveLength(1)
    expect(document.querySelector('.setup-hero-background')).toBe(hero)
    await finishTransition()
    expect(document.querySelector('.setup-hero-background')).toBe(hero)
    expect(screen.getAllByTestId('card-illustration')).toHaveLength(1)
})
