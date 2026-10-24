/**
 * QR pay's own unlock offer: a verify-once user goes straight to /verify and
 * never sees it; a user on today's flow keeps it.
 */
/** @jest-environment jsdom */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { findKycDocumentPlan, getKycDocumentStatus } from '@/app/actions/kyc-workflow'
import { QrKycState } from '@/constants/kyc.consts'
import { QrPayKycGateView } from '../QrPayKycGateView'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => '/qr-pay' }))
jest.mock('@/app/actions/kyc-workflow', () => ({ findKycDocumentPlan: jest.fn(), getKycDocumentStatus: jest.fn() }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/modals/KycRegionRestrictedModal', () => ({ KycRegionRestrictedModal: () => null }))
jest.mock('../../QrPayFlowContext', () => ({
    useQrPayFlow: () => ({
        gate: {
            kycGateState: QrKycState.REQUIRES_IDENTITY_VERIFICATION,
            sumsubFlow: { errorCooldown: null, handleInitiateKyc: jest.fn() },
            isKycApproved: false,
            startVerification: jest.fn(),
        },
        methodIcon: undefined,
        targetMantecaCountry: 'AR',
        onBack: jest.fn(),
    }),
}))

const plan = (flow: string) => ({
    available: true,
    routes: [],
    flow,
    features: { qr: true, bank: false, local: false, card: false },
})
const renderView = () =>
    render(
        <IntlWrapper>
            <QrPayKycGateView />
        </IntlWrapper>
    )

beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getKycDocumentStatus).mockResolvedValue('NOT_STARTED')
})

it('sends a verify-once user to /verify instead of the unlock offer; today’s flow keeps the offer', async () => {
    jest.mocked(findKycDocumentPlan).mockResolvedValue(plan('verify-once') as never)
    const { unmount } = renderView()
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/verify'))
    expect(screen.queryByText('Unlock QR payments')).not.toBeInTheDocument()
    unmount()

    jest.mocked(findKycDocumentPlan).mockResolvedValue(plan('document-first') as never)
    mockPush.mockClear()
    renderView()
    expect(await screen.findByText('Unlock QR payments')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
})
