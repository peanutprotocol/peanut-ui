import { fireEvent, screen } from '@testing-library/react'
import ExchangeRate from '@/components/ExchangeRate'
import { AccountType } from '@/interfaces/interfaces'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'

const mockUseGetExchangeRate = jest.fn()
jest.mock('@/hooks/useGetExchangeRate', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockUseGetExchangeRate(...args),
}))

const rateState = (overrides: Record<string, unknown> = {}) => ({
    exchangeRate: null,
    isFetchingRate: false,
    isRateError: false,
    refetchRate: jest.fn(),
    ...overrides,
})

describe('ExchangeRate', () => {
    it('shows the rate when it loaded', () => {
        mockUseGetExchangeRate.mockReturnValue(rateState({ exchangeRate: '0.9200' }))
        renderWithIntl(<ExchangeRate accountType={AccountType.IBAN} />)
        expect(screen.getByText('1 USD = 0.9200 EUR')).toBeInTheDocument()
    })

    it('offers a retry instead of a bare dash when the rate failed', () => {
        const state = rateState({ isRateError: true })
        mockUseGetExchangeRate.mockReturnValue(state)
        renderWithIntl(<ExchangeRate accountType={AccountType.IBAN} />)

        expect(screen.getByText(en.errors.rateUnavailable)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.common.retry }))
        expect(state.refetchRate).toHaveBeenCalledTimes(1)
    })

    it('shows the loading row, not the error, while a retry is in flight', () => {
        mockUseGetExchangeRate.mockReturnValue(rateState({ isRateError: true, isFetchingRate: true }))
        renderWithIntl(<ExchangeRate accountType={AccountType.IBAN} />)
        expect(screen.queryByText(en.errors.rateUnavailable)).not.toBeInTheDocument()
    })
})
