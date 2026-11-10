/** @jest-environment jsdom */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderRow', () => ({
    ProviderRow: ({ providerId }: { providerId: string }) => <div>provider {providerId}</div>,
}))

import { PixWithdrawReview } from '../components/PixWithdrawReview'

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

describe('PixWithdrawReview', () => {
    it("shows the reais, the rate with the fees in, the flat fee apart, the API's arrival time and the provider", () => {
        renderWithIntl(
            <PixWithdrawReview
                title="Withdraw"
                display={display}
                providerId="avenia-br"
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
        expect(screen.getByText(en.pix.withdraw.fee)).toBeInTheDocument()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
        expect(screen.getByText('About 1 minute')).toBeInTheDocument()
        expect(screen.getByText('provider avenia-br')).toBeInTheDocument()
    })

    // a provider whose fees all sit in the rate sends a zero flat fee: no fee line, the same rate rule
    it('shows no fee line for a provider with no flat fee', () => {
        renderWithIntl(
            <PixWithdrawReview
                title="Withdraw"
                display={{ ...display, fixedFeeBrl: '0', amountBrl: '503.75', provider: 'Manteca' }}
                providerId="manteca-br"
                isLoading={false}
                isSubmitting={false}
                error={null}
                canConfirm
                onBack={jest.fn()}
                onConfirm={jest.fn()}
                onCancel={jest.fn()}
            />
        )
        expect(screen.getByText('R$503.75')).toBeInTheDocument()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.getByText('1 USD = BRL 5.445946')).toBeInTheDocument()
        expect(screen.getByText('provider manteca-br')).toBeInTheDocument()
    })

    // a refused preview has no numbers: its message and action stand alone, no empty rows, no skeleton
    it('shows a refused preview as its message and its action only', () => {
        const { container } = renderWithIntl(
            <PixWithdrawReview
                title="Withdraw"
                display={null}
                providerId="avenia-br"
                isLoading={false}
                isSubmitting={false}
                error={{
                    message: en.pix.withdraw.errors.limitExceeded,
                    action: { label: en.common.retry, onClick: jest.fn() },
                }}
                canConfirm={false}
                onBack={jest.fn()}
                onConfirm={jest.fn()}
                onCancel={jest.fn()}
            />
        )
        expect(screen.getByText(en.pix.withdraw.errors.limitExceeded)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: en.common.retry })).toBeInTheDocument()
        expect(container.querySelector('.animate-pulse, .animate-spin')).toBeNull()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.queryByRole('button', { name: en.common.confirm })).toBeNull()
    })
})
