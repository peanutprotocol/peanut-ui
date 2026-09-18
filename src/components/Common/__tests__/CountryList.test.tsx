/**
 * CountryList — the send->bank supported-country gate (enforceSupportedCountries).
 *
 * The send flow reuses the withdraw country list, gated so users cannot pick a
 * country with no send rail. Pinned here:
 * 1. Brazil is selectable — a PIX send to a third-party key rides the Manteca
 *    QR-payment endpoint, so the send->bank flow must let users reach it.
 * 2. Argentina opens the notification waitlist — its Manteca rails here are own-account
 *    offramps (same ruling that keeps Mercado Pago off the send list, PR #2813).
 * 3. Bridge countries (e.g. Germany) stay selectable.
 *
 * Also pinned: which country sits at the top of the list (TASK-22589). A
 * KYC-verified residence wins over the IP lookup — the IP moves when the user
 * travels or turns on a VPN, the residence the rails are bound to does not.
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

let mockGeoCountry: string | null = null
jest.mock('@/hooks/useGeoLocation', () => ({
    useGeoLocation: () => ({ countryCode: mockGeoCountry, isLoading: false }),
}))

let mockResidence: string | null = null
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => ({ user: { residence: { declared: null, verified: mockResidence } } }),
}))

jest.mock('@/components/Global/EasterEggDrawer', () => ({
    __esModule: true,
    default: () => null,
    EASTER_EGG_COUNTRIES: {},
}))

jest.mock('../CountryWaitlist', () => ({
    CountryWaitlist: ({ countryCode, flow }: { countryCode: string; flow: string }) => (
        <div data-testid="country-waitlist">
            {countryCode}:{flow}
        </div>
    ),
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

    test('Argentina opens the send waitlist without starting an own-account withdrawal)', () => {
        const argentina = row('Argentina')
        expect(argentina).not.toHaveAttribute('aria-disabled')
        expect(screen.queryByText('Soon')).not.toBeInTheDocument()
        fireEvent.click(argentina)
        expect(screen.getByTestId('country-waitlist')).toHaveTextContent('AR:send')
        expect(onCountryClick).not.toHaveBeenCalled()
    })

    test('a bridge country stays selectable', () => {
        const germany = row('Germany')
        expect(germany).not.toHaveAttribute('aria-disabled')
        fireEvent.click(germany)
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'germany' }))
    })

    // Colombia is a Bridge bank corridor (co_bank_transfer), so the send->bank
    // list must offer it, not the waitlist — the picker reads the same corridor
    // table the form does. This is the drift this consolidation closed.
    test('Colombia is selectable — its Bridge corridor is wired', () => {
        const colombia = row('Colombia')
        expect(colombia).not.toHaveAttribute('aria-disabled')
        fireEvent.click(colombia)
        expect(onCountryClick).toHaveBeenCalledWith(expect.objectContaining({ path: 'colombia' }))
    })
})

describe('CountryList — which country comes first', () => {
    const renderList = () =>
        render(<CountryList inputTitle="How?" viewMode="add-withdraw" flow="withdraw" onCountryClick={jest.fn()} />)

    const firstCountry = () => screen.getAllByRole('button')[0].textContent ?? ''

    afterEach(() => {
        mockGeoCountry = null
        mockResidence = null
    })

    it('the verified residence wins over the IP country', () => {
        mockResidence = 'BR'
        mockGeoCountry = 'DE'
        renderList()
        expect(firstCountry()).toContain('Brazil')
    })

    it('falls back to the IP country when no residence is verified', () => {
        mockResidence = null
        mockGeoCountry = 'DE'
        renderList()
        expect(firstCountry()).toContain('Germany')
    })

    it('with neither, the preferred corridors keep their declared order', () => {
        renderList()
        expect(firstCountry()).toContain('United States')
    })
})

/**
 * The add-money hub opens this list inside a card whose first row is the "Other
 * countries" toggle. The rows have to continue that card rather than open a
 * second one under it — a rounded top edge mid-card reads as a broken row.
 */
describe('CountryList — continuing a card the caller opened', () => {
    const renderList = (continuesGroup: boolean) =>
        render(
            <CountryList
                viewMode="add-withdraw"
                flow="add"
                searchTerm="germany"
                continuesGroup={continuesGroup}
                onCountryClick={jest.fn()}
            />
        )

    it('squares the first row off, and renders no search field of its own', () => {
        renderList(true)

        expect(screen.getAllByRole('button')[0]).not.toHaveClass('rounded-t-sm')
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('rounds it as a card of its own otherwise', () => {
        renderList(false)

        expect(screen.getAllByRole('button')[0]).toHaveClass('rounded-sm')
    })
})
