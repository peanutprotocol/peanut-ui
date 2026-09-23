/** @jest-environment jsdom */
/**
 * Setup chrome: the back chevron must inherit currentColor (the nav circle button
 * inverts on hover/active, and a hard-coded black stroke vanished into it).
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupWrapper, useSetupImageOverride } from '../SetupWrapper'

const mockReducedMotion = { value: true }

jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => false }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@/utils/capacitor', () => ({ ...jest.requireActual('@/utils/capacitor'), isCapacitor: () => false }))
jest.mock('@/components/0_Bruddle/CloudsBackground', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: ({ pose }: { pose: string }) => <div data-testid="mascot" data-mascot-pose={pose} />,
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
        const hero = screen.getByTestId('mascot').closest('.bg-background-setup-hero')
        const panel = screen.getByText('First step').closest('.bg-white')

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
        expect(screen.getByTestId('mascot').closest('.bg-background-setup-hero')).toBe(hero)
        expect(screen.getByText('Second step').closest('.bg-white')).toBe(panel)
        expect(hero).toHaveClass('h-[35dvh]', 'shrink-0')
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
