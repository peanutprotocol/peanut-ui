/**
 * TASK-24947: a Brazil resident on the ARS page was told "We cannot open a ARS account"
 * above the Pix line ("Pix deposits, withdrawals, transfers and QR payments are available
 * where you live"). Under a currency title a local refusal for the residence names the residence.
 */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import messages from '@/i18n/app/messages/en.json'
import { useKycFeatureActivation } from '../useKycFeatureActivation'
import { KycFeatureActivationGate } from '../KycFeatureActivationGate'

jest.mock('../useKycFeatureActivation', () => ({ useKycFeatureActivation: jest.fn() }))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContextOptional: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))

it.each(['local_served_elsewhere', 'local_residence_unsupported'])(
    'local %s under ARS names the residence',
    (reason) => {
        jest.mocked(useKycFeatureActivation).mockReturnValue({
            allowed: false,
            userReady: true,
            selectedStatus: undefined,
            result: { kind: 'report', report: { state: 'refused', reason } },
            isLoading: false,
            arsProvisioning: false,
            activate: jest.fn(),
        } as unknown as ReturnType<typeof useKycFeatureActivation>)
        renderWithIntl(
            <KycFeatureActivationGate feature="local" selectedCurrency="ARS">
                <div>local flow</div>
            </KycFeatureActivationGate>
        )
        expect(screen.getByText('ARS accounts are not available for residents of your country.')).toBeInTheDocument()
        expect(screen.queryByText(messages.kyc.supplement.servedElsewhere)).toBeNull()
        expect(screen.queryByText('local flow')).toBeNull()
    }
)
