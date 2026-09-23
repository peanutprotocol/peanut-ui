/** @jest-environment jsdom */
/**
 * Setup chrome: the back chevron must inherit currentColor (the nav circle button
 * inverts on hover/active, and a hard-coded black stroke vanished into it).
 */
import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupWrapper, useSetupImageOverride } from '../SetupWrapper'

const mockReducedMotion = { value: true }
const mockCapacitor = { value: false }
const mockSetBackgroundColor = jest.fn()

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
        }: {
            children: React.ReactNode
            className?: string
            variants?: {
                enter: (direction: number) => { x: string | number }
                exit: (direction: number) => { x: string | number }
            }
            custom?: number
            transition?: { duration?: number }
        }) => (
            <div
                className={className}
                data-enter-x={variants?.enter(custom).x}
                data-exit-x={variants?.exit(custom).x}
                data-transition-duration={transition?.duration}
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

const StepWithImageOverride = () => {
    useSetupImageOverride({ pose: 'cheering' })
    return <div>Residence outcome</div>
}

describe('SetupWrapper transitions', () => {
    it('sizes the landing pose down while keeping the other setup illustrations comparable', () => {
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
        expect(screen.getByTestId('mascot')).not.toHaveClass('scale-[0.8]')

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

    it('updates the older Android status bar to the destination color', async () => {
        jest.useFakeTimers()
        mockCapacitor.value = true
        mockReducedMotion.value = false
        mockSetBackgroundColor.mockClear()
        document.documentElement.style.setProperty('--color-background-setup-hero', '#90a8ed')
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
            expect(mockSetBackgroundColor).toHaveBeenCalledWith({ color: '#90a8ed' })

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
            expect(mockSetBackgroundColor).toHaveBeenLastCalledWith({ color: '#ff90e8' })
        } finally {
            mockCapacitor.value = false
            mockReducedMotion.value = true
            document.documentElement.style.removeProperty('--color-background-setup-hero')
            document.documentElement.style.removeProperty('--color-action-primary')
            jest.useRealTimers()
        }
    })

    it('blends the hero from blue to pink across the journey and reverses on Back', () => {
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
            'color-mix(in oklab, var(--color-background-setup-hero) 100%, var(--color-action-primary))'
        )
        expect(hero).toHaveClass('transition-colors', 'motion-reduce:transition-none')

        rerender(
            <SetupWrapper layoutType="signup" screenId="signup" step={2} totalSteps={6} image={{ pose: 'thinking' }}>
                <div>Signup</div>
            </SetupWrapper>
        )
        expect(container.querySelector('.setup-hero-background')).toBe(hero)
        expect(document.documentElement.style.getPropertyValue('--setup-hero-background')).toBe(
            'color-mix(in oklab, var(--color-background-setup-hero) 60%, var(--color-action-primary))'
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
            'color-mix(in oklab, var(--color-background-setup-hero) 0%, var(--color-action-primary))'
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
            'color-mix(in oklab, var(--color-background-setup-hero) 100%, var(--color-action-primary))'
        )
    })

    it('uses pink on the standalone finish route without a step cursor', () => {
        const { container } = renderWithIntl(
            <SetupWrapper layoutType="signup" screenId="sign-test-transaction" image={{ pose: 'waving-chill' }}>
                <div>Finish</div>
            </SetupWrapper>
        )
        expect(container.querySelector('.setup-hero-background')).toBeInTheDocument()
        expect(document.documentElement.style.getPropertyValue('--setup-hero-background')).toBe(
            'color-mix(in oklab, var(--color-background-setup-hero) 0%, var(--color-action-primary))'
        )
    })

    it('keeps white progress dots above the mascot and updates the active step', () => {
        const { rerender } = renderWithIntl(
            <SetupWrapper layoutType="signup" screenId="signup" step={2} totalSteps={6} image={{ pose: 'thinking' }}>
                <div>Sign up</div>
            </SetupWrapper>
        )
        const dots = screen.getByRole('group', { name: 'Step 3 of 6' })
        expect(dots).toHaveClass('absolute', 'top-8', 'z-20')
        expect(dots.closest('.setup-hero-background')).toContainElement(screen.getByTestId('mascot'))
        expect(dots.children).toHaveLength(6)
        expect(dots.children[2]).toHaveClass('w-6', 'bg-white')
        expect(dots.children[3]).toHaveClass('bg-white/60')

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
        expect(dots.children[2]).toHaveClass('bg-white/60')
        expect(dots.children[3]).toHaveClass('w-6', 'bg-white')
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
