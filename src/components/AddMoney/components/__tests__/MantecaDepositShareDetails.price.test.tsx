import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { renderWithIntl } from '@/test-utils/intl'
import InputAmountStep from '../InputAmountStep'
import MantecaDepositShareDetails from '../MantecaDepositShareDetails'
import type { MantecaDepositResponseData } from '@/types/manteca.types'
import type { AppLocale } from '@/i18n/app/config'

jest.mock('next/navigation', () => ({
    useParams: () => ({ country: 'argentina' }),
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Profile/AvatarWithBadge', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderHelp', () => ({ ProviderHelp: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => null }))

// an order of 100.000 ARS at the locked 1.746,62, as Manteca returns it after "Continue"
const order = {
    details: {
        depositAddress: '0000003100000000000001',
        depositAlias: 'peanut.alias',
        price: '1746.62',
        withdrawCostInAsset: '0.001',
    },
    stages: { '1': { thresholdAmount: '100000', asset: 'ARS' }, '3': { amount: '57.256' } },
} as unknown as MantecaDepositResponseData

const renderIn = (locale: AppLocale) =>
    render(
        <NextIntlClientProvider locale={locale} messages={en} timeZone="UTC">
            <MantecaDepositShareDetails depositDetails={order} onBack={jest.fn()} />
        </NextIntlClientProvider>
    )

// Argentines read "1,746.62" as 1.74 (TASK-25349)
it('prints the rate and the amounts with Argentine separators for an es-AR user', () => {
    renderIn('es-AR')
    expect(screen.getByText('1 USD = 1.746,62 ARS')).toBeInTheDocument()
    expect(screen.getByText('ARS 100.000')).toBeInTheDocument()
    expect(screen.getByText(/57,26 USD/)).toBeInTheDocument()
})

it('keeps US separators for an English user', () => {
    renderIn('en')
    expect(screen.getByText('1 USD = 1,746.62 ARS')).toBeInTheDocument()
    expect(screen.getByText('ARS 100,000')).toBeInTheDocument()
    expect(screen.getByText(/57.26 USD/)).toBeInTheDocument()
})

// "≈" marks an estimate. After "Continue" the order has locked its price, and a "≈" next to it
// invites the doubt the user came to settle (TASK-25349).
describe('estimate versus locked price', () => {
    it('the amount step, before the order exists, marks the USD figure as an estimate', () => {
        renderWithIntl(
            <InputAmountStep
                tokenAmount=""
                setTokenAmount={jest.fn()}
                onSubmit={jest.fn()}
                isLoading={false}
                error={null}
                setCurrencyAmount={jest.fn()}
                currencyData={{
                    code: 'ARS',
                    symbol: 'ARS',
                    price: { buy: 1746.62, sell: 1700 },
                    isLoading: false,
                    isError: false,
                    refetch: jest.fn(),
                }}
                initialDenomination="ARS"
                limitsCurrency="ARS"
                onBack={jest.fn()}
            />
        )
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '100000' } })
        expect(screen.getByText(/≈ USD 57\.25/)).toBeInTheDocument()
    })

    it('the transfer details, after the order locked its price, show the USD amount without "≈"', () => {
        renderIn('en')
        expect(screen.getByText('57.26 USD')).toBeInTheDocument()
        expect(screen.queryByText(/≈/)).not.toBeInTheDocument()
    })
})
