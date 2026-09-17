import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { CountryData } from '@/components/AddMoney/consts'
import { AddMoneyCountryRoutesView } from '../AddMoneyCountryRoutesView'
import type { AddMoneyRoute } from '../../countryRoutes'

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title, onPrev }: { title: string; onPrev: () => void }) => (
        <button data-testid="nav-header" onClick={onPrev}>
            {title}
        </button>
    ),
}))

const BRAZIL: CountryData = {
    id: 'BR',
    type: 'country',
    title: 'Brazil',
    currency: 'BRL',
    path: 'brazil',
    iso2: 'BR',
}

const ROUTES: AddMoneyRoute[] = [
    { corridor: 'BANK_TRANSFER_BR', kind: 'standing' },
    { corridor: 'PIX_BR', kind: 'top-up', href: '/add-money/brazil/manteca' },
]

const renderView = (onSelect = jest.fn(), onBack = jest.fn()) => {
    render(
        <IntlWrapper>
            <AddMoneyCountryRoutesView country={BRAZIL} routes={ROUTES} onBack={onBack} onSelect={onSelect} />
        </IntlWrapper>
    )
    return { onSelect, onBack }
}

describe('AddMoneyCountryRoutesView', () => {
    it('tells the two Pix products apart, because the rail name cannot', () => {
        renderView()

        // Both corridors are named "Pix" in the catalog — the row says which of
        // the two things it is, so the user is not picking between two Pixes.
        expect(screen.getByText('Standing Pix details')).toBeInTheDocument()
        expect(screen.getByText('One-off Pix top-up')).toBeInTheDocument()
    })

    it('hands back the route that was chosen, not just the corridor', () => {
        const { onSelect } = renderView()

        fireEvent.click(screen.getByTestId('add-money-route-top-up'))
        expect(onSelect).toHaveBeenCalledWith(ROUTES[1])

        fireEvent.click(screen.getByTestId('add-money-route-standing'))
        expect(onSelect).toHaveBeenCalledWith(ROUTES[0])
    })

    it('names the country in the header and goes back from it', () => {
        const { onBack } = renderView()

        const header = screen.getByTestId('nav-header')
        expect(header).toHaveTextContent('Brazil')
        fireEvent.click(header)
        expect(onBack).toHaveBeenCalled()
    })
})
