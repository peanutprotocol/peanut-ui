/**
 * The failed-scan card. A scan the API refuses for identity (MANTECA_KYC_REQUIRED)
 * used to end on "Go back" alone, while the capabilities said the user could pay
 * (TASK-23747). The card now starts the verification, unless the ID check already
 * ended on a final decision: then it says so and offers support.
 */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { QrPayBlockedView } from '../views/QrPayBlockedView'

jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
const mockSetSupportOpen = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockSetSupportOpen }),
}))

const mockStartVerification = jest.fn()
const mockOnBack = jest.fn()
const flow = {
    view: 'INIT_ERROR',
    paymentMethodName: 'Pix',
    errorInitiatingPayment: en.qrPay.errors.kycRequired,
    initErrorNeedsSupport: false,
    initErrorNeedsVerification: true,
    targetMantecaCountry: 'BR',
    gate: { isTerminalFailure: false, startVerification: mockStartVerification, sumsubFlow: { isLoading: false } },
    onBack: mockOnBack,
    retryOrderNotReady: jest.fn(),
}
jest.mock('../QrPayFlowContext', () => ({ useQrPayFlow: () => flow }))

beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(flow, {
        errorInitiatingPayment: en.qrPay.errors.kycRequired,
        initErrorNeedsSupport: false,
        initErrorNeedsVerification: true,
    })
    flow.gate.isTerminalFailure = false
})

describe('QrPayBlockedView — failed scan', () => {
    it('a refusal for identity starts the verification for the scanned country', () => {
        renderWithIntl(<QrPayBlockedView />)

        expect(screen.getByText(en.qrPay.errors.kycRequired)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.qrPay.kyc.unlockCta }))

        expect(mockStartVerification).toHaveBeenCalledWith('BR')
        // Go back stays, as the second choice
        fireEvent.click(screen.getByRole('button', { name: en.qrPay.maintenance.goBack }))
        expect(mockOnBack).toHaveBeenCalled()
    })

    it('an ID check that ended on a final decision offers support, never a verification', () => {
        flow.gate.isTerminalFailure = true
        renderWithIntl(<QrPayBlockedView />)

        expect(screen.getByText(en.qrPay.kyc.blockedDescription)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.qrPay.kyc.unlockCta })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.qrPay.havingTrouble }))
        expect(mockSetSupportOpen).toHaveBeenCalledWith(true)
    })

    it('any other refusal keeps the card as it was', () => {
        Object.assign(flow, { initErrorNeedsVerification: false, errorInitiatingPayment: en.qrPay.errors.pixDecode })
        renderWithIntl(<QrPayBlockedView />)

        expect(screen.getByText(en.qrPay.errors.pixDecode)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.qrPay.kyc.unlockCta })).not.toBeInTheDocument()
    })
})
