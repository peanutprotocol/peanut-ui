/**
 * TASK-24968: Bridge refused a verify-once user's bank accounts as a duplicate.
 * The bank screen with no currency picked said "this feature isn't available
 * with the current verification"; it now names the cause and offers support,
 * like the one-currency refusal.
 */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import messages from '@/i18n/app/messages/en.json'
import { useKycFeatureActivation } from '../useKycFeatureActivation'
import { KycFeatureActivationGate } from '../KycFeatureActivationGate'

const mockOpenSupport = jest.fn()
jest.mock('../useKycFeatureActivation', () => ({ useKycFeatureActivation: jest.fn() }))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContextOptional: () => ({ setIsSupportModalOpen: mockOpenSupport }),
}))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

const duplicate = {
    state: 'refused' as const,
    reason: 'duplicate_customer_detected',
    message: 'Linked to another account',
    action: 'contact-support:bridge-duplicate',
}

function activation(selectedStatus: typeof duplicate | undefined) {
    jest.mocked(useKycFeatureActivation).mockReturnValue({
        allowed: false,
        userReady: true,
        selectedStatus,
        result: null,
        isLoading: false,
        arsProvisioning: false,
        activate: jest.fn(),
    } as unknown as ReturnType<typeof useKycFeatureActivation>)
}

beforeEach(() => jest.clearAllMocks())

it('bank with no currency: names the duplicate and offers support', () => {
    activation(duplicate)
    renderWithIntl(
        <KycFeatureActivationGate feature="bank">
            <div>bank flow</div>
        </KycFeatureActivationGate>
    )
    expect(screen.getByText(messages.depositAccounts.gate.blockedTitleAll)).toBeInTheDocument()
    expect(screen.getByText(messages.identity.reasons.duplicate_customer_detected)).toBeInTheDocument()
    expect(screen.queryByText('bank flow')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: messages.common.contactSupport }))
    expect(mockOpenSupport).toHaveBeenCalledWith(true)
})

it('one currency keeps its own title', () => {
    activation(duplicate)
    renderWithIntl(
        <KycFeatureActivationGate feature="bank" selectedCurrency="USD">
            <div>bank flow</div>
        </KycFeatureActivationGate>
    )
    expect(screen.getByText('We cannot open a USD account')).toBeInTheDocument()
    expect(screen.getByText(messages.identity.reasons.duplicate_customer_detected)).toBeInTheDocument()
})
