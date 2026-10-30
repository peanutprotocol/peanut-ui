/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { InitiateKycModal } from '../InitiateKycModal'

jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: false }),
}))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/add-money/argentina/manteca',
}))
// the dismiss button stands in for every vaul gesture (swipe, overlay, back),
// which all reach onOpenChange(false)
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({
        open,
        dismissible = true,
        onOpenChange,
        children,
    }: {
        open: boolean
        dismissible?: boolean
        onOpenChange: (open: boolean) => void
        children: React.ReactNode
    }) =>
        open ? (
            <div data-testid="drawer" data-dismissible={String(dismissible)}>
                <button onClick={() => onOpenChange(false)}>dismiss</button>
                {children}
            </div>
        ) : null,
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DrawerDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

const renderModal = (props: Partial<React.ComponentProps<typeof InitiateKycModal>> = {}) => {
    const onClose = jest.fn()
    render(
        <IntlWrapper>
            <InitiateKycModal visible onClose={onClose} onVerify={jest.fn()} {...props} />
        </IntlWrapper>
    )
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    return onClose
}

describe('InitiateKycModal — dismissal', () => {
    it('cannot be dismissed while verification is starting', () => {
        const onClose = renderModal({ isLoading: true })
        expect(screen.getByTestId('drawer')).toHaveAttribute('data-dismissible', 'false')
        expect(onClose).not.toHaveBeenCalled()
    })

    it('dismisses when nothing is in flight', () => {
        const onClose = renderModal()
        expect(screen.getByTestId('drawer')).toHaveAttribute('data-dismissible', 'true')
        expect(onClose).toHaveBeenCalled()
    })

    it('keeps the blocked variant dismissible even while loading', () => {
        const onClose = renderModal({ variant: 'blocked', isLoading: true })
        expect(screen.getByTestId('drawer')).toHaveAttribute('data-dismissible', 'true')
        expect(onClose).toHaveBeenCalled()
    })
})
