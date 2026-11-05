/**
 * QR pay's restart screen when a provider asked for a new ID: it says why in
 * the reason's own words and its button opens the identity restart.
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { QrKycState } from '@/constants/kyc.consts'
import { QrPayProviderRejectionView } from '../QrPayProviderRejectionView'

const mockHandleRestartIdentity = jest.fn()
let mockReason: string | null = null
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/qr-pay' }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('../../QrPayFlowContext', () => ({
    useQrPayFlow: () => ({
        gate: {
            kycGateState: QrKycState.PROVIDER_RESTART_IDENTITY,
            qrKycUserMessage: 'English prose from the API',
            qrKycActionKey: null,
            needsIdentityRestart: true,
            identityRestartReason: mockReason,
            sumsubFlow: { errorCooldown: null, handleRestartIdentity: mockHandleRestartIdentity },
        },
        methodIcon: undefined,
        onBack: jest.fn(),
    }),
}))

const renderView = () =>
    render(
        <IntlWrapper>
            <QrPayProviderRejectionView />
        </IntlWrapper>
    )

beforeEach(() => jest.clearAllMocks())

it.each([
    ['id_expired', 'Your ID has expired. Add a valid one to keep your accounts working.'],
    ['id_verification_failed', "We couldn't verify your ID. Add a valid one to keep your accounts working."],
    ['identity_verification_required', 'Our card partner needs a new photo of your ID and a selfie.'],
])('a provider asking for a new ID (%s) says why and opens the identity restart', (reason, copy) => {
    mockReason = reason
    renderView()
    expect(screen.getByText(copy)).toBeInTheDocument()
    expect(screen.queryByText('English prose from the API')).not.toBeInTheDocument()
    expect(screen.queryByText('We couldn’t read your ID number')).not.toBeInTheDocument()

    const cta = screen.getAllByText('Verify with a different document').find((node) => node.closest('button'))
    fireEvent.click(cta!)
    expect(mockHandleRestartIdentity).toHaveBeenCalled()
})
