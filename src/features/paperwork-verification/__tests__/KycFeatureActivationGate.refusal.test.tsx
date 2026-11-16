/**
 * TASK-24968: Bridge refused a verify-once user's bank accounts as a duplicate.
 * The bank screen with no currency picked said "this feature isn't available
 * with the current verification"; it now names the cause and offers support,
 * like the one-currency refusal.
 *
 * TASK-24967: the duplicate's title asks about the other account, with or
 * without a currency. Other refusals keep "We cannot open".
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
    expect(screen.getByText('Already have an account?')).toBeInTheDocument()
    expect(
        screen.getByText(
            'Your details are already linked to another Peanut account. If you can, log in and use that account, otherwise contact support.'
        )
    ).toBeInTheDocument()
    expect(screen.queryByText('bank flow')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: messages.common.contactSupport }))
    expect(mockOpenSupport).toHaveBeenCalledWith(true)
})

it('one currency asks about the other account too', () => {
    activation(duplicate)
    renderWithIntl(
        <KycFeatureActivationGate feature="bank" selectedCurrency="USD">
            <div>bank flow</div>
        </KycFeatureActivationGate>
    )
    expect(screen.getByText('Already have an account?')).toBeInTheDocument()
    expect(screen.queryByText('We cannot open a USD account')).toBeNull()
    expect(screen.getByText(messages.identity.reasons.duplicate_customer_detected)).toBeInTheDocument()
})

it('another refusal keeps the "We cannot open" title', () => {
    const terminal = { ...duplicate, reason: 'bridge_terminal_rejection' }
    activation(terminal)
    const { unmount } = renderWithIntl(
        <KycFeatureActivationGate feature="bank">
            <div>bank flow</div>
        </KycFeatureActivationGate>
    )
    expect(screen.getByText('We cannot open your bank accounts')).toBeInTheDocument()
    expect(screen.queryByText(messages.depositAccounts.gate.duplicateTitle)).toBeNull()
    unmount()

    renderWithIntl(
        <KycFeatureActivationGate feature="bank" selectedCurrency="USD">
            <div>bank flow</div>
        </KycFeatureActivationGate>
    )
    expect(screen.getByText('We cannot open a USD account')).toBeInTheDocument()
})
