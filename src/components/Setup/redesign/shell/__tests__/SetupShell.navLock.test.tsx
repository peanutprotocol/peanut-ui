/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { SetupShell } from '@/components/Setup/redesign/shell/SetupShell'
import { NAV_LOCK_MAX_MS, NAV_LOCK_MIN_MS } from '@/components/Setup/redesign/shell/useNavLock'

jest.mock('framer-motion', () =>
    require('@/components/Setup/redesign/Accounts/__tests__/framerMock').framerMotionForShell(() => mockReduced)
)
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))

let mockReduced = true
const SCREENS: ScreenId[] = ['landing', 'advantage-fees', 'advantage-card', 'residence']

/** A three-step flow on the real shell: each Continue goes one step on, Back one step back. */
function Flow({ onTap, navigates = true }: { onTap?: () => void; navigates?: boolean }) {
    const [index, setIndex] = useState(0)
    const [direction, setDirection] = useState(0)
    const id = SCREENS[index]
    return (
        <SetupShell
            screenId={id}
            direction={direction}
            showBackButton={index > 0}
            onBack={() => {
                setDirection(-1)
                setIndex((i) => Math.max(0, i - 1))
            }}
        >
            <SetupScreen
                key={id}
                ground={index % 2 ? 'yellow' : 'sky'}
                state={id}
                footer={{
                    primary: {
                        label: `Continue ${id}`,
                        onClick: () => {
                            onTap?.()
                            if (!navigates) return
                            setDirection(1)
                            setIndex((i) => Math.min(SCREENS.length - 1, i + 1))
                        },
                    },
                }}
            >
                <p>{id}</p>
            </SetupScreen>
        </SetupShell>
    )
}

const shell = () => document.querySelector('[data-setup-shell]') as HTMLElement
const shown = () => shell().getAttribute('data-setup-screen')
const cta = () => document.querySelector('[data-setup-footer] button') as HTMLButtonElement
const unlocked = (timeout = NAV_LOCK_MAX_MS - 200) =>
    waitFor(() => expect(shell()).not.toHaveAttribute('data-nav-locked'), { timeout })

describe.each([
    ['reduced motion', true],
    ['full motion', false],
])('SetupShell navigation lock (R2-01), %s', (_name, isReduced) => {
    beforeEach(() => {
        mockReduced = isReduced
    })

    it.each([0, 200, 400])('a double tap %i ms apart goes exactly one step', async (gap) => {
        render(<Flow />)
        expect(shown()).toBe('landing')
        fireEvent.click(cta())
        if (gap) await act(() => new Promise((resolve) => setTimeout(resolve, gap)))
        // the second tap lands on the next screen's button, at the same spot, while it slides in
        fireEvent.click(cta())
        expect(shown()).toBe('advantage-fees')
        await unlocked()
        expect(shown()).toBe('advantage-fees')
    })

    it('lets go when the next screen has come to rest, not on the safety timer, and the next tap steps', async () => {
        render(<Flow />)
        const start = Date.now()
        fireEvent.click(cta())
        expect(shell()).toHaveAttribute('data-nav-locked')
        await unlocked()
        const held = Date.now() - start
        expect(held).toBeGreaterThanOrEqual(NAV_LOCK_MIN_MS - 20)
        expect(held).toBeLessThan(NAV_LOCK_MAX_MS - 200)
        expect(screen.getByRole('button', { name: 'Continue advantage-fees' })).toBe(cta())
        fireEvent.click(cta())
        expect(shown()).toBe('advantage-card')
    })

    it('drops a Back tap while a step is in flight', async () => {
        render(<Flow />)
        fireEvent.click(cta())
        await unlocked()
        fireEvent.click(cta())
        expect(shown()).toBe('advantage-card')
        fireEvent.click(screen.getByRole('button', { name: 'goBack' }))
        expect(shown()).toBe('advantage-card')
        await unlocked()
        fireEvent.click(screen.getByRole('button', { name: 'goBack' }))
        expect(shown()).toBe('advantage-fees')
    })

    it('a tap that changes no screen locks nothing, so a retry is never dropped', () => {
        const onTap = jest.fn()
        render(<Flow onTap={onTap} navigates={false} />)
        fireEvent.click(cta())
        expect(shell()).not.toHaveAttribute('data-nav-locked')
        fireEvent.click(cta())
        expect(onTap).toHaveBeenCalledTimes(2)
    })
})
