/** @jest-environment jsdom */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderRow', () => ({ ProviderRow: () => null }))

import { AveniaWithdrawReview } from '../components/AveniaWithdrawReview'

const display = {
    amountBrl: '503.00',
    pixKey: '09579927189',
    ownAccount: true as const,
    holderName: 'Ana Souza',
    bankName: 'Banco Inter',
    withdrawUsd: '92.504310',
    rate: '5.445692',
    fixedFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Avenia' as const,
}

describe('AveniaWithdrawReview', () => {
    it("shows the reais, the rate with the fees in, Avenia's flat fee apart, and the API's arrival time", () => {
        renderWithIntl(
            <AveniaWithdrawReview
                title="Withdraw"
                display={display}
                isLoading={false}
                isSubmitting={false}
                error={null}
                canConfirm
                onBack={jest.fn()}
                onConfirm={jest.fn()}
                onCancel={jest.fn()}
            />
        )
        expect(screen.getByText('R$503')).toBeInTheDocument()
        expect(screen.getByText('$92.50')).toBeInTheDocument()
        // $92.50 × 5.445946 − R$0.75 = R$503.00: the three numbers agree to the centavo
        expect(screen.getByText('1 USD = BRL 5.445946')).toBeInTheDocument()
        expect(screen.getByText(en.avenia.withdraw.aveniaFee)).toBeInTheDocument()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
        expect(screen.getByText('About 1 minute')).toBeInTheDocument()
    })
})
