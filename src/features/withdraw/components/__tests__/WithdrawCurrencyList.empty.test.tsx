/**
 * The picker and the country list it can open both say "no results". With the
 * REAL CountryList mounted, a search nothing answers must say so exactly once,
 * whichever of the two is showing (TASK-20721 review).
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('next-intl', () => ({
    useLocale: () => 'en',
    useTranslations: (ns: string) => {
        const t = (key: string) => `${ns}.${key}`
        t.rich = (key: string) => `${ns}.${key}`
        return t
    },
}))
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: { alt?: string }) => <img alt={props.alt ?? ''} />,
}))
jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/destinations/useHomeCountry', () => ({ useHomeCountry: () => ({ countryCode: null }) }))
jest.mock('@/components/Global/EasterEggDrawer', () => ({
    __esModule: true,
    default: () => null,
    EASTER_EGG_COUNTRIES: [],
}))
jest.mock('@/components/Common/CountryWaitlist', () => ({ CountryWaitlist: () => null }))
jest.mock('@/components/Global/EmptyStates/EmptyState', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}))
// The real list draws every country; a handful is enough to prove the
// empty-state rule and keeps the suite fast.
jest.mock('@/components/AddMoney/consts', () => {
    const actual = jest.requireActual<typeof import('@/components/AddMoney/consts')>('@/components/AddMoney/consts')
    const KEEP = new Set(['germany', 'spain', 'united-kingdom', 'usa', 'brazil', 'argentina', 'india'])
    return {
        ...actual,
        countryData: actual.countryData.filter((country) => country.type !== 'country' || KEEP.has(country.path)),
    }
})

import { WithdrawCurrencyList } from '../WithdrawCurrencyList'

const renderList = () =>
    render(<WithdrawCurrencyList heading="Cash out" onCountryClick={jest.fn()} onCryptoClick={jest.fn()} />)
const search = (term: string) =>
    fireEvent.change(screen.getByLabelText('withdraw.currencyList.searchPlaceholder'), { target: { value: term } })
const openOtherCountries = () => fireEvent.click(screen.getByTestId('withdraw-other-countries-toggle'))

describe('WithdrawCurrencyList — one "no results", never two', () => {
    it('with Other countries already open, a search nothing answers shows one message', () => {
        renderList()
        openOtherCountries()
        search('zzzz')

        expect(screen.getAllByTestId('empty-state')).toHaveLength(1)
        expect(screen.queryByTestId('withdraw-currencies')).not.toBeInTheDocument()
    })

    it('with Other countries closed, the same search shows one message', () => {
        renderList()
        search('zzzz')

        expect(screen.getAllByTestId('empty-state')).toHaveLength(1)
    })

    it('a country-only answer is shown, not replaced by a message', () => {
        renderList()
        search('India')

        expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
        expect(screen.getByText('India')).toBeInTheDocument()
    })

    it('the message clears once a row answers again', async () => {
        renderList()
        openOtherCountries()
        search('zzzz')
        expect(screen.getAllByTestId('empty-state')).toHaveLength(1)

        search('eur')
        expect(screen.getByTestId('withdraw-currency-EUR')).toBeInTheDocument()
        // the country list filters through useDeferredValue, one render behind
        await waitFor(() => expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument())
    })
})
