/**
 * CountryList — the send->bank supported-country gate (enforceSupportedCountries).
 *
 * The send flow reuses the withdraw country list, gated so users cannot pick a
 * country with no send rail. Pinned here:
 * 1. Brazil is selectable — a PIX send to a third-party key rides the Manteca
 *    QR-payment endpoint, so the send->bank flow must let users reach it.
 * 2. Argentina stays disabled — its Manteca rails in this flow are own-account
 *    offramps (same ruling that keeps Mercado Pago off the send list, PR #2813).
 * 3. Bridge countries (e.g. Germany) stay selectable.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

jest.mock('next/navigation', () => ({
    useSearchParams: () => ({ get: () => null }),
}))

// next/image — render a plain <img>
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        const { priority, layout, objectFit, fill, loading, onError, ...rest } = props
        return <img {...rest} />
    },
}))

jest.mock('@/hooks/useGeoLocation', () => ({
    useGeoLocation: () => ({ countryCode: null, isLoading: false }),
}))

jest.mock('@/components/Global/EasterEggModal', () => ({
    __esModule: true,
    default: () => null,
    EASTER_EGG_COUNTRIES: {},
}))

import { CountryList } from '../CountryList'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

const row = (name: string) => {
    const title = screen.getByText(name)
    const card = title.closest('[role="button"]')
    expect(card).not.toBeNull()
    return card as HTMLElement
}

describe('CountryList — enforceSupportedCountries (send->bank flow)', () => {
    const onCountryClick = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        render(
            <CountryList
                inputTitle="How?"
                viewMode="add-withdraw"
                flow="withdraw"
                enforceSupportedCountries
                onCountryClick={onCountryClick}
                showLoadingState={false}
            />
        )
    })

    test('Brazil is selectable and clicking it selects the country', () => {
        const brazil = row('Brazil')
        expect(brazil).not.toHaveAttribute('aria-disabled')
        fireEvent.click(brazil)
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'brazil' }))
    })

    test('Argentina stays disabled (own-account rails only)', () => {
        const argentina = row('Argentina')
        expect(argentina).toHaveAttribute('aria-disabled', 'true')
        fireEvent.click(argentina)
        expect(onCountryClick).not.toHaveBeenCalled()
    })

    test('a bridge country stays selectable', () => {
        const germany = row('Germany')
        expect(germany).not.toHaveAttribute('aria-disabled')
        fireEvent.click(germany)
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'germany' }))
    })
})
