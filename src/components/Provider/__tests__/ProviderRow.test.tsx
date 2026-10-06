import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import type { ProviderId } from '@/types/provider.types'
import { openExternalUrl } from '@/utils/capacitor'
import { ProviderFinePrint } from '../ProviderFinePrint'
import { ProviderRow } from '../ProviderRow'

jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    openExternalUrl: jest.fn(() => Promise.resolve()),
}))

beforeAll(() => {
    window.matchMedia =
        window.matchMedia ||
        ((query: string) =>
            ({
                matches: false,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false,
                onchange: null,
            }) as MediaQueryList)
})

const withIntl = (ui: React.ReactNode) =>
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            {ui}
        </NextIntlClientProvider>
    )

const openSheet = (brand: string) => {
    fireEvent.click(screen.getByRole('button', { name: `About ${brand}` }))
    return screen.getByRole('dialog')
}

describe('ProviderRow', () => {
    it('shows the label, the brand and a (?) that opens the sheet', () => {
        withIntl(<ProviderRow providerId="bridge-eea" />)
        expect(screen.getByText('Provider')).toBeInTheDocument()
        expect(screen.getByText('Bridge')).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        const sheet = openSheet('Bridge')
        expect(within(sheet).getByText('Bridge Building S.A.')).toBeInTheDocument()
        expect(within(sheet).getByText('CSSF: MiCA CASP N00000012, EMI W00000024')).toBeInTheDocument()
        expect(within(sheet).getByText('Sumsub (Sum and Substance Ltd)')).toBeInTheDocument()
        fireEvent.click(within(sheet).getByRole('button', { name: /^Terms/ }))
        expect(openExternalUrl).toHaveBeenCalledWith('https://www.bridge.xyz/legal/eea-user-terms/bridge-building-s-a')
    })

    it.each([
        ['accountProvider', 'Account provider'],
        ['cardIssuer', 'Card issuer'],
    ] as const)('labels the row %s', (label, text) => {
        withIntl(<ProviderRow providerId="bridge-us" label={label} />)
        expect(screen.getByText(text)).toBeInTheDocument()
    })

    it('hides fields the registry leaves out', () => {
        withIntl(<ProviderRow providerId="bridge" />)
        const sheet = openSheet('Bridge')
        for (const label of ['Legal name', 'Registered office', 'Registration', 'Regulator', 'Privacy policy']) {
            expect(within(sheet).queryByText(label)).not.toBeInTheDocument()
        }
        expect(within(sheet).getByText('Identity check')).toBeInTheDocument()
        expect(within(sheet).getByText(/never holds your money/)).toBeInTheDocument()
    })

    it.each<ProviderId>(['manteca-ar', 'rhino', 'third-national'])('shows no identity check line for %s', (id) => {
        withIntl(<ProviderRow providerId={id} />)
        openSheet(id === 'rhino' ? 'Rhino.fi' : id === 'third-national' ? 'Third National' : 'Manteca')
        expect(within(screen.getByRole('dialog')).queryByText('Identity check')).not.toBeInTheDocument()
    })

    it('uses the card intro for the card issuer and drops the missing terms row', () => {
        withIntl(<ProviderRow providerId="third-national" label="cardIssuer" />)
        const sheet = openSheet('Third National')
        expect(within(sheet).getByText(/Third National issues your Peanut card/)).toBeInTheDocument()
        expect(within(sheet).queryByRole('button', { name: /^Terms/ })).not.toBeInTheDocument()
        expect(within(sheet).getByRole('button', { name: /^Privacy policy/ })).toBeInTheDocument()
    })

    it('uses the prospective card intro before the card terms are accepted', () => {
        withIntl(<ProviderRow providerId="third-national" label="cardIssuer" prospective />)
        const sheet = openSheet('Third National')
        expect(
            within(sheet).getByText(/When you accept the card terms, your relationship is directly with them\./)
        ).toBeInTheDocument()
        expect(within(sheet).queryByText(/Third National issues your Peanut card/)).not.toBeInTheDocument()
    })
})

describe('ProviderFinePrint', () => {
    it('reads "Provider · Manteca" with the (?)', () => {
        withIntl(<ProviderFinePrint providerId="manteca-br" />)
        expect(screen.getByText('Provider · Manteca')).toBeInTheDocument()
        const sheet = openSheet('Manteca')
        expect(within(sheet).getByText('CNPJ 63.653.001/0001-55')).toBeInTheDocument()
    })
})

describe('ProviderSheet intro', () => {
    const relationship = /You have a direct relationship/

    it('states the direct relationship when the user accepted the provider terms', () => {
        withIntl(<ProviderRow providerId="bridge-eea" />)
        const sheet = openSheet('Bridge')
        expect(within(sheet).getByText(/Bridge provides this service, not Peanut\./)).toBeInTheDocument()
        expect(within(sheet).getByText(relationship)).toBeInTheDocument()
    })

    it('speaks of the relationship as ahead before the user accepts', () => {
        withIntl(<ProviderRow providerId="bridge-eea" prospective />)
        const sheet = openSheet('Bridge')
        expect(
            within(sheet).getByText('When you accept, your relationship is directly with Bridge, under their terms.')
        ).toBeInTheDocument()
        expect(within(sheet).queryByText(relationship)).not.toBeInTheDocument()
    })

    it('puts the intro in an info callout and the legal facts and documents in one card', () => {
        withIntl(<ProviderRow providerId="bridge-eea" />)
        const sheet = openSheet('Bridge')
        expect(within(sheet).getByRole('status')).toHaveTextContent(
            'Bridge provides this service, not Peanut. Peanut is self-custodial wallet software by Squirrel Labs Ltd and never holds your money.'
        )
        expect(within(sheet).getByText('Bank transfers and accounts in your name')).toBeInTheDocument()
        const legalCard = within(sheet).getByText('Legal name').closest('.ds-data-row')?.parentElement as HTMLElement
        expect(within(legalCard).getByText('Bridge Building S.A.')).toBeInTheDocument()
        expect(within(legalCard).getByText('Identity check')).toBeInTheDocument()
        expect(within(legalCard).getByRole('button', { name: /^Terms/ })).toHaveTextContent('Bridge EEA user terms')
        expect(within(legalCard).getByRole('button', { name: /^Privacy policy/ })).toBeInTheDocument()
    })

    it('leaves it out for rhino, where peanut is the customer', () => {
        withIntl(<ProviderRow providerId="rhino" />)
        const sheet = openSheet('Rhino.fi')
        expect(within(sheet).getByText(/^Rhino\.fi provides this service, not Peanut\./)).toBeInTheDocument()
        expect(within(sheet).queryByText(relationship)).not.toBeInTheDocument()
    })

    it('treats a manteca payment like any other: relationship line, no account row', () => {
        withIntl(<ProviderRow providerId="manteca-ar" />)
        const sheet = openSheet('Manteca')
        expect(within(sheet).getByText(relationship)).toBeInTheDocument()
        expect(within(sheet).queryByText(/Peanut's account/)).not.toBeInTheDocument()
        expect(within(sheet).queryByText('Paid from')).not.toBeInTheDocument()
    })
})
