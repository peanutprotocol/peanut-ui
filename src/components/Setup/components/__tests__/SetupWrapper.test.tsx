/** @jest-environment jsdom */
/**
 * Setup chrome: the back chevron must inherit currentColor (the nav circle button
 * inverts on hover/active, and a hard-coded black stroke vanished into it).
 */
import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupWrapper, useSetupImageOverride, useSetupFullScreen } from '../SetupWrapper'

const mockReducedMotion = { value: true }
const mockCapacitor = { value: false }
const mockSetBackgroundColor = jest.fn()

jest.mock('@/i18n/app/locale-context', () => ({ useAppLocale: () => ({ locale: 'en', setLocale: jest.fn() }) }))

jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => false }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isCapacitor: () => mockCapacitor.value,
}))
jest.mock('@capacitor/status-bar', () => ({
    StatusBar: { setBackgroundColor: (...args: unknown[]) => mockSetBackgroundColor(...args) },
}))
jest.mock('@/components/0_Bruddle/CloudsBackground', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: ({ pose, className }: { pose: string; className?: string }) => (
        <div data-testid="mascot" data-mascot-pose={pose} className={className} />
    ),
}))
jest.mock('framer-motion', () => ({
    useReducedMotion: () => mockReducedMotion.value,
    useIsPresent: () => true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: ({
            children,
            className,
            variants,
            custom = 0,
            transition,
            animate,
            'aria-hidden': ariaHidden,
            inert,
        }: {
            children: React.ReactNode
            'aria-hidden'?: boolean
            inert?: boolean
            className?: string
            variants?: {
                enter: (direction: number) => { x: string | number }
                exit: (direction: number) => { x: string | number }
            }
            custom?: number
            transition?: { duration?: number }
            animate?: { y?: string | number }
        }) => (
            <div
                className={className}
                aria-hidden={ariaHidden}
                inert={inert}
                data-enter-x={variants?.enter(custom).x}
                data-exit-x={variants?.exit(custom).x}
                data-transition-duration={transition?.duration}
                data-animate-y={animate?.y}
            >
                {children}
            </div>
        ),
    },
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))
function renderWrapper(props: Partial<React.ComponentProps<typeof SetupWrapper>> = {}) {
    return renderWithIntl(
        <SetupWrapper layoutType="signup" screenId="signup" title="Pick a handle" {...props}>
            <div data-testid="step" />
        </SetupWrapper>
    )
}

describe('SetupWrapper navigation', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockReducedMotion.value = true
    })

    it('renders the back chevron without a hard-coded stroke colour', () => {
        renderWrapper({ showBackButton: true, onBack: jest.fn() })
        const svg = screen.getByRole('button', { name: 'Go back' }).querySelector('svg')
        expect(svg).not.toBeNull()
        expect(svg).not.toHaveAttribute('stroke', 'black')
        expect(svg).toHaveAttribute('stroke', 'currentColor')
    })

    it('offsets the navigation row by the measured safe-area inset', () => {
        renderWrapper({ showBackButton: true, onBack: jest.fn() })
        const row = screen.getByRole('button', { name: 'Go back' }).closest('div.absolute')
        expect(row).toHaveClass('top-[calc(var(--safe-top)_+_1rem)]', 'px-4')
    })

    it('keeps the trailing logout action on the same navigation row as Back', () => {
        renderWrapper({ showBackButton: true, showLogoutButton: true, onBack: jest.fn(), onLogout: jest.fn() })
        const back = screen.getByRole('button', { name: 'Go back' })
        const logout = screen.getByRole('button', { name: 'Logout' })
        expect(back.closest('div.absolute')).toBe(logout.closest('div.absolute'))
    })

    it('fires onBack from the back button', () => {
        const onBack = jest.fn()
        renderWrapper({ showBackButton: true, onBack })
        fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
        expect(onBack).toHaveBeenCalledTimes(1)
    })
})

describe('Setup input focus modality', () => {
    it('keeps pointer focus while typing and restores keyboard focus for navigation', () => {
        const view = renderWithIntl(
            <SetupWrapper layoutType="signup" screenId="signup">
                <input aria-label="Username" />
                <button type="button">Next</button>
            </SetupWrapper>
        )
        const input = screen.getByRole('textbox', { name: 'Username' })
        const next = screen.getByRole('button', { name: 'Next' })
        expect(input.closest('[data-setup-flow]')).toBeInTheDocument()
        expect(document.documentElement).toHaveAttribute('data-setup-input-modality', 'keyboard')

        fireEvent.pointerDown(input)
        expect(document.documentElement).toHaveAttribute('data-setup-input-modality', 'pointer')
        fireEvent.keyDown(input, { key: ' ' })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(document.documentElement).toHaveAttribute('data-setup-input-modality', 'pointer')

        fireEvent.keyDown(next, { key: 'Tab' })
        expect(document.documentElement).toHaveAttribute('data-setup-input-modality', 'keyboard')
        fireEvent.pointerDown(next)
        fireEvent.keyDown(next, { key: ' ' })
        expect(document.documentElement).toHaveAttribute('data-setup-input-modality', 'keyboard')

        view.unmount()
        expect(document.documentElement).not.toHaveAttribute('data-setup-input-modality')
    })
})

const StepWithImageOverride = () => {
    useSetupImageOverride({ pose: 'cheering' })
    return <div>Residence outcome</div>
}

describe('SetupWrapper transitions', () => {
    it('uses the same mascot scale on landing and username while keeping later illustrations comparable', () => {
        const { rerender, container } = renderWithIntl(
            <SetupWrapper layoutType="signup" screenId="landing" image={{ pose: 'waving-chill' }}>
                <div>Landing</div>
            </SetupWrapper>
        )
        expect(screen.getByTestId('mascot')).toHaveClass('scale-[0.8]')

        rerender(
            <SetupWrapper layoutType="signup" screenId="signup" image={{ pose: 'thinking' }}>
                <div>Signup</div>
            </SetupWrapper>
        )
        expect(screen.getByTestId('mascot')).toHaveClass('scale-[0.8]')

        rerender(
            <SetupWrapper layoutType="signup" screenId="sign-test-transaction" image={{ pose: 'waving-chill' }}>
                <div>Ready</div>
            </SetupWrapper>
        )
        expect(screen.getByTestId('mascot')).not.toHaveClass('scale-[0.8]')

        rerender(
            <SetupWrapper layoutType="signup" screenId="advantage-rewards" image={{ scene: 'coins' }}>
                <div>Rewards</div>
            </SetupWrapper>
        )
        expect(container.querySelector('[data-mascot-scene="coins"]')).toHaveClass('h-56', 'md:h-64')
        expect(screen.getByTestId('mascot')).toHaveClass('h-56', 'md:h-64')

        rerender(
            <SetupWrapper layoutType="signup" screenId="passkey-permission" image={{ scene: 'safe' }}>
                <div>Passkey</div>
            </SetupWrapper>
        )
        expect(container.querySelector('[data-mascot-scene="safe"]')).toHaveClass('h-52')
        expect(container.querySelector('[data-mascot-scene="safe"]')).not.toHaveClass('h-64')
    })

    it('keeps the older Android status bar blue throughout setup', async () => {
        jest.useFakeTimers()
        mockCapacitor.value = true
        mockReducedMotion.value = false
        mockSetBackgroundColor.mockClear()
        document.documentElement.style.setProperty('--color-background-setup-hero', '#d8e7ff')
        document.documentElement.style.setProperty('--color-action-primary', '#ff90e8')
        try {
            const { rerender } = renderWithIntl(
                <SetupWrapper
                    layoutType="signup"
                    screenId="landing"
                    step={0}
                    totalSteps={6}
                    image={{ pose: 'waving-chill' }}
                >
                    <div>Landing</div>
                </SetupWrapper>
            )
            await act(async () => {
                jest.advanceTimersByTime(220)
                await Promise.resolve()
            })
            expect(mockSetBackgroundColor).toHaveBeenCalledWith({ color: '#d8e7ff' })

            rerender(
                <SetupWrapper
                    layoutType="signup"
                    screenId="sign-test-transaction"
                    step={5}
                    totalSteps={6}
                    image={{ pose: 'waving-chill' }}
                >
                    <div>Finish</div>
                </SetupWrapper>
            )
            await act(async () => {
                jest.advanceTimersByTime(220)
                await Promise.resolve()
            })
            expect(mockSetBackgroundColor).toHaveBeenLastCalledWith({ color: '#d8e7ff' })
        } finally {
            mockCapacitor.value = false
            mockReducedMotion.value = true
            document.documentElement.style.removeProperty('--color-background-setup-hero')
            document.documentElement.style.removeProperty('--color-action-primary')
            jest.useRealTimers()
        }
    })

    it('keeps the original blue hero throughout the journey and on Back', () => {
        const { container, rerender } = renderWithIntl(
            <SetupWrapper
                layoutType="signup"
                screenId="landing"
                step={0}
                totalSteps={6}
                image={{ pose: 'waving-chill' }}
            >
                <div>Landing</div>
            </SetupWrapper>
        )
        const hero = container.querySelector('.setup-hero-background')
        expect(document.documentElement.style.getPropertyValue('--setup-hero-background')).toBe(
            'var(--color-background-setup-hero)'
        )
        expect(hero).toHaveClass('transition-colors', 'motion-reduce:transition-none')

        rerender(
            <SetupWrapper layoutType="signup" screenId="signup" step={2} totalSteps={6} image={{ pose: 'thinking' }}>
                <div>Signup</div>
            </SetupWrapper>
        )
        expect(container.querySelector('.setup-hero-background')).toBe(hero)
        expect(document.documentElement.style.getPropertyValue('--setup-hero-background')).toBe(
            'var(--color-background-setup-hero)'
        )

        rerender(
            <SetupWrapper
                layoutType="signup"
                screenId="sign-test-transaction"
                step={3}
                totalSteps={4}
                image={{ pose: 'waving-chill' }}
            >
                <div>Finish</div>
            </SetupWrapper>
        )
        expect(document.documentElement.style.getPropertyValue('--setup-hero-background')).toBe(
            'var(--color-background-setup-hero)'
        )

        rerender(
            <SetupWrapper
                layoutType="signup"
                screenId="landing"
                step={0}
                totalSteps={6}
                image={{ pose: 'waving-chill' }}
            >
                <div>Landing</div>
            </SetupWrapper>
        )
        expect(document.documentElement.style.getPropertyValue('--setup-hero-background')).toBe(
            'var(--color-background-setup-hero)'
        )
    })

    it('uses blue on the standalone finish route without a step cursor', () => {
        const { container } = renderWithIntl(
            <SetupWrapper layoutType="signup" screenId="sign-test-transaction" image={{ pose: 'waving-chill' }}>
                <div>Finish</div>
            </SetupWrapper>
        )
        expect(container.querySelector('.setup-hero-background')).toBeInTheDocument()
        expect(document.documentElement.style.getPropertyValue('--setup-hero-background')).toBe(
            'var(--color-background-setup-hero)'
        )
    })

    it('keeps contrasting progress dots above the mascot and updates the active step', () => {
        const { rerender } = renderWithIntl(
            <SetupWrapper layoutType="signup" screenId="signup" step={2} totalSteps={6} image={{ pose: 'thinking' }}>
                <div>Sign up</div>
            </SetupWrapper>
        )
        const dots = screen.getByRole('group', { name: 'Step 3 of 6' })
        expect(dots.parentElement?.parentElement).toHaveClass('absolute', 'top-4', 'z-20')
        expect(dots.closest('.setup-hero-background')).toContainElement(screen.getByTestId('mascot'))
        expect(dots.children).toHaveLength(6)
        expect(dots.children[2]).toHaveClass('w-6', 'bg-border-default')
        expect(dots.children[3]).toHaveClass('bg-border-subtle')

        rerender(
            <SetupWrapper
                layoutType="signup"
                screenId="residence"
                step={3}
                totalSteps={6}
                image={{ pose: 'waving-hello' }}
            >
                <div>Residence</div>
            </SetupWrapper>
        )
        expect(screen.getByRole('group', { name: 'Step 4 of 6' })).toBe(dots)
        expect(dots.children[2]).toHaveClass('bg-border-subtle')
        expect(dots.children[3]).toHaveClass('w-6', 'bg-border-default')
    })

    it('keeps the hero and panel mounted while sliding the mascot and step content forward', () => {
        mockReducedMotion.value = false
        const { container, rerender } = renderWithIntl(
            <SetupWrapper
                layoutType="signup"
                screenId="landing"
                step={0}
                direction={1}
                image={{ pose: 'waving-chill' }}
                title="Welcome"
            >
                <div>First step</div>
            </SetupWrapper>
        )
        const shell = container.firstElementChild
        const hero = screen.getByTestId('mascot').closest('.setup-hero-background')
        const panel = screen.getByText('First step').closest('.bg-white')
        expect(shell).toHaveClass('bg-background-setup-hero')

        rerender(
            <SetupWrapper
                layoutType="signup"
                screenId="welcome"
                step={1}
                direction={1}
                image={{ pose: 'pointing' }}
                title="Next step"
            >
                <div>Second step</div>
            </SetupWrapper>
        )

        expect(container.firstElementChild).toBe(shell)
        expect(shell).not.toHaveClass('bg-background-setup-hero')
        expect(screen.getByTestId('mascot').closest('.setup-hero-background')).toBe(hero)
        expect(screen.getByText('Second step').closest('.bg-white')).toBe(panel)
        expect(hero).toHaveClass('h-[47dvh]', 'shrink-0')
        expect(screen.getByTestId('mascot').parentElement).toHaveAttribute('data-enter-x', '100%')
        expect(screen.getByTestId('mascot').parentElement).toHaveAttribute('data-exit-x', '-100%')
        expect(screen.getByText('Next step').closest('[data-enter-x]')).toHaveAttribute('data-enter-x', '48')
    })

    it('reverses the slide on browser Back even if the stored direction is stale', () => {
        mockReducedMotion.value = false
        const { rerender } = renderWithIntl(
            <SetupWrapper
                layoutType="signup"
                screenId="welcome"
                step={1}
                direction={1}
                image={{ pose: 'pointing' }}
                title="Next step"
            >
                <div>Second step</div>
            </SetupWrapper>
        )

        rerender(
            <SetupWrapper
                layoutType="signup"
                screenId="landing"
                step={0}
                direction={1}
                image={{ pose: 'waving-chill' }}
                title="Welcome"
            >
                <div>First step</div>
            </SetupWrapper>
        )

        expect(screen.getByTestId('mascot').parentElement).toHaveAttribute('data-enter-x', '-100%')
        expect(screen.getByTestId('mascot').parentElement).toHaveAttribute('data-exit-x', '100%')
        expect(screen.getByText('Welcome').closest('[data-enter-x]')).toHaveAttribute('data-enter-x', '-48')
    })

    it('uses an instant transition for reduced motion', () => {
        mockReducedMotion.value = true
        renderWrapper({ image: { pose: 'thinking' } })
        expect(screen.getByTestId('mascot').parentElement).toHaveAttribute('data-transition-duration', '0')
        expect(screen.getByText('Pick a handle').closest('[data-enter-x]')).toHaveAttribute(
            'data-transition-duration',
            '0'
        )
    })

    it('uses a full-page checklist and restores the illustration when leaving the outcome', () => {
        const FullPage = () => {
            useSetupFullScreen(true)
            return <h1>Good news</h1>
        }
        const { container, rerender } = renderWithIntl(
            <SetupWrapper layoutType="signup" screenId="residence" image={{ pose: 'thinking' }}>
                <FullPage />
            </SetupWrapper>
        )
        expect(container.querySelector('.setup-hero-background')).not.toBeInTheDocument()
        expect(screen.queryByTestId('mascot')).not.toBeInTheDocument()
        expect(document.documentElement.style.getPropertyValue('--setup-hero-background')).toBe(
            'var(--color-background-default)'
        )
        rerender(
            <SetupWrapper layoutType="signup" screenId="residence" image={{ pose: 'thinking' }}>
                <div>Country picker</div>
            </SetupWrapper>
        )
        expect(screen.getByTestId('mascot')).toBeInTheDocument()
        expect(document.documentElement.style.getPropertyValue('--setup-hero-background')).toBe(
            'var(--color-background-setup-hero)'
        )
    })

    it('does not carry a step image override into the next step', () => {
        const { rerender } = renderWithIntl(
            <SetupWrapper layoutType="signup" screenId="residence" step={3} image={{ pose: 'waving-hello' }}>
                <StepWithImageOverride />
            </SetupWrapper>
        )
        expect(screen.getByTestId('mascot')).toHaveAttribute('data-mascot-pose', 'cheering')

        rerender(
            <SetupWrapper layoutType="signup" screenId="passkey-permission" step={4} image={{ pose: 'too-cool' }}>
                <div>Passkey setup</div>
            </SetupWrapper>
        )
        expect(screen.getByTestId('mascot')).toHaveAttribute('data-mascot-pose', 'too-cool')
    })
})

describe('First-launch landing handoff', () => {
    it('returns the white panel to the viewport when a web landing skips the intro with reduced motion', () => {
        mockReducedMotion.value = true
        renderWrapper({ screenId: 'landing' })
        expect(screen.getByTestId('step').closest('.bg-white')).toHaveAttribute('data-animate-y', '0')
    })

    it('keeps one mascot mounted while the greeting gives way to accessible setup controls', async () => {
        jest.useFakeTimers()
        try {
            const { container } = renderWithIntl(
                <SetupWrapper
                    layoutType="signup"
                    screenId="landing"
                    image={{ pose: 'waving-chill' }}
                    firstLaunchIntroPreview="play"
                >
                    <button type="button">Sign up</button>
                </SetupWrapper>
            )
            const mascot = screen.getByTestId('mascot')
            expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument()
            await act(async () => {
                await Promise.resolve()
            })
            await act(async () => {
                jest.advanceTimersByTime(1500)
            })
            await act(async () => {
                jest.advanceTimersByTime(700)
            })
            expect(screen.getByText('Hey, I’m Peanut')).toBeInTheDocument()
            expect(container.querySelector('[data-first-launch-intro]')).toHaveAttribute(
                'data-first-launch-intro',
                'intro'
            )
            await act(async () => {
                jest.advanceTimersByTime(4300)
            })
            expect(screen.queryByText('Hey, I’m Peanut')).not.toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
            expect(screen.getByTestId('mascot')).toBe(mascot)
            expect(container.querySelector('[data-first-launch-intro]')).toBeNull()
        } finally {
            jest.useRealTimers()
        }
    })
})
