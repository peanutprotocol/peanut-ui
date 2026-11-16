import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { authReady } from '@/utils/auth-token'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { InitiateKycModal } from '../InitiateKycModal'
import en from '@/i18n/app/messages/en.json'

jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: () => {} }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { username: 'deadline-user' } } }) }))
jest.mock('@/app/actions/kyc-workflow', () => ({
    findKycDocumentPlan: jest.fn(async () => null),
    findKycReplacementPlan: jest.fn(async () => null),
    resumeKycDocumentAttempt: jest.fn(),
}))
jest.mock('@/utils/auth-token', () => ({
    authReady: jest.fn(),
    getAuthToken: jest.fn(() => 'test-token'),
    getAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer test-token' })),
}))
jest.mock('@/utils/sentry.utils', () => ({ fetchWithSentry: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isRegionRestricted: false }) }))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/add-money/argentina/manteca',
}))
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({
        open,
        dismissible,
        onOpenChange,
        children,
    }: {
        open: boolean
        dismissible: boolean
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

it('unlocks the drawer with an error when actual KYC start is parked on auth readiness', async () => {
    jest.useFakeTimers()
    jest.mocked(authReady).mockReturnValue(new Promise(() => {}))
    const onClose = jest.fn()
    function Gate() {
        const flow = useSumsubKycFlow()
        return (
            <>
                <button onClick={() => void flow.handleInitiateKyc('ROW')}>Start</button>
                <InitiateKycModal
                    visible
                    variant="provider_rejection"
                    onClose={onClose}
                    onVerify={() => void flow.handleInitiateKyc('ROW')}
                    isLoading={flow.isLoading}
                    error={flow.error}
                />
            </>
        )
    }
    try {
        render(
            <IntlWrapper>
                <Gate />
            </IntlWrapper>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Start' }))
        await act(async () => {
            await Promise.resolve()
        })
        expect(authReady).toHaveBeenCalled()
        expect(screen.getByTestId('drawer')).toHaveAttribute('data-dismissible', 'false')
        await act(async () => {
            await jest.advanceTimersByTimeAsync(30_001)
        })
        expect(screen.getByTestId('drawer')).toHaveAttribute('data-dismissible', 'true')
        expect(screen.getByTestId('drawer')).toHaveTextContent(en.kyc.errorInitiateFailed)
        expect(fetchWithSentry).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
        expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
        jest.clearAllTimers()
        jest.useRealTimers()
    }
})
