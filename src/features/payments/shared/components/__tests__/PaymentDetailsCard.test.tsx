/** @jest-environment jsdom */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { PROVIDERS } from '@/constants/providers.consts'

jest.mock('@/components/Provider/ProviderHelp', () => ({
    ProviderHelp: ({ providerId }: { providerId: string }) => <span>help {providerId}</span>,
}))

import { PaymentDetailsCard } from '../PaymentDetailsCard'

describe('PaymentDetailsCard', () => {
    it('shows the rate, the savings against a card, the sponsored Peanut fee, the provider fee and the provider', () => {
        renderWithIntl(
            <PaymentDetailsCard
                rate={{ price: 5.4, code: 'BRL' }}
                savings={{ usd: '0.93', currencyCode: 'BRL' }}
                providerFee="R$0.75"
                providerId="manteca-br"
            />
        )
        expect(screen.getByText(en.qrPay.info.exchangeRate)).toBeInTheDocument()
        expect(screen.getByText('1 USD = 5.4 BRL')).toBeInTheDocument()
        expect(screen.getByText(en.qrPay.info.saveVsCard)).toBeInTheDocument()
        expect(screen.getByText('~$0.93')).toBeInTheDocument()
        expect(screen.getByText(en.common.peanutFee)).toBeInTheDocument()
        expect(screen.getByText(en.common.sponsoredByPeanut)).toBeInTheDocument()
        expect(screen.getByText(en.pix.withdraw.fee)).toBeInTheDocument()
        expect(screen.getByText('R$0.75')).toBeInTheDocument()
        expect(screen.getByText(en.provider.label.provider)).toBeInTheDocument()
        expect(screen.getByText(PROVIDERS['manteca-br'].brand)).toBeInTheDocument()
    })

    // the savings row is the payment's; the provider fee row only when the quote carries one; no provider, no row
    it('shows only the rows it is given', () => {
        renderWithIntl(<PaymentDetailsCard rate={{ price: 5.4, code: 'BRL' }} providerId={null} />)
        expect(screen.getByText('1 USD = 5.4 BRL')).toBeInTheDocument()
        expect(screen.getByText(en.common.sponsoredByPeanut)).toBeInTheDocument()
        expect(screen.queryByText(en.qrPay.info.saveVsCard)).toBeNull()
        expect(screen.queryByText(en.pix.withdraw.fee)).toBeNull()
        expect(screen.queryByText(en.provider.label.provider)).toBeNull()
    })
})
