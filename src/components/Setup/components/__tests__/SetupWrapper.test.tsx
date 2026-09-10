/** @jest-environment jsdom */
/**
 * Setup chrome: the back chevron must inherit currentColor (the stroke button
 * inverts on hover/active, and a hard-coded black stroke vanished into it).
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupWrapper } from '../SetupWrapper'

jest.mock('@/hooks/useBravePWAInstallState', () => ({ useBravePWAInstallState: () => ({ isBrave: false }) }))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => false }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@/utils/capacitor', () => ({ ...jest.requireActual('@/utils/capacitor'), isCapacitor: () => false }))
jest.mock('@/components/0_Bruddle/CloudsBackground', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Setup/Views/InstallPWA', () => ({ __esModule: true, default: () => null }))
jest.mock('framer-motion', () => ({
    useReducedMotion: () => true,
    motion: {
        div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
            <div className={className}>{children}</div>
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
