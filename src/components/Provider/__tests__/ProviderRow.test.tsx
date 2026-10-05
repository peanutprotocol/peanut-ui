import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import type { ProviderId } from '@/types/provider.types'
import { ProviderRow } from '../ProviderRow'
import { ProviderNote } from '../ProviderNote'

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
    it('shows the label and brand, and opens the sheet on (?)', () => {
        withIntl(<ProviderRow providerId="bridge-eea" label="accountProvider" />)
        expect(screen.getByText('Account provider')).toBeInTheDocument()
        expect(screen.getByText('Bridge')).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        const sheet = openSheet('Bridge')
        expect(within(sheet).getByText('Bridge Building S.A.')).toBeInTheDocument()
        expect(within(sheet).getByText('CSSF: MiCA CASP N00000012, EMI W00000024')).toBeInTheDocument()
        expect(within(sheet).getByText('Sumsub (Sum and Substance Ltd)')).toBeInTheDocument()
        expect(within(sheet).getByRole('link', { name: /Terms/ })).toHaveAttribute(
            'href',
            'https://www.bridge.xyz/legal/eea-user-terms/bridge-building-s-a'
        )
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
        withIntl(<ProviderRow providerId={id} variant="stacked" />)
        const sheet = openSheet(id === 'rhino' ? 'Rhino.fi' : id === 'third-national' ? 'Third National' : 'Manteca')
        expect(within(sheet).queryByText('Identity check')).not.toBeInTheDocument()
    })

    it('uses the card intro for the card issuer and drops the missing terms link', () => {
        withIntl(<ProviderRow providerId="third-national" label="cardIssuer" />)
        expect(screen.getByText('Card issuer')).toBeInTheDocument()
        const sheet = openSheet('Third National')
        expect(within(sheet).getByText(/Third National issues your Peanut card/)).toBeInTheDocument()
        expect(within(sheet).queryByRole('link', { name: /^Terms/ })).not.toBeInTheDocument()
        expect(within(sheet).getByRole('link', { name: /Privacy policy/ })).toBeInTheDocument()
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

    it('puts the intro in an info callout and the legal facts in one card', () => {
        withIntl(<ProviderRow providerId="bridge-eea" />)
        const sheet = openSheet('Bridge')
        expect(within(sheet).getByRole('status')).toHaveTextContent(
            'Bridge provides this service, not Peanut. Peanut is self-custodial wallet software by Squirrel Labs Ltd and never holds your money.'
        )
        expect(within(sheet).getByText('Bank transfers and accounts in your name')).toBeInTheDocument()
        const legalCard = within(sheet).getByText('Legal name').closest('.ds-data-row')?.parentElement as HTMLElement
        expect(within(legalCard).getByText('Bridge Building S.A.')).toBeInTheDocument()
        expect(within(legalCard).getByText('Identity check')).toBeInTheDocument()
    })

    it('leaves it out for rhino, where peanut is the customer', () => {
        withIntl(<ProviderRow providerId="rhino" />)
        const sheet = openSheet('Rhino.fi')
        expect(within(sheet).getByText(/^Rhino\.fi provides this service, not Peanut\./)).toBeInTheDocument()
        expect(within(sheet).queryByText(relationship)).not.toBeInTheDocument()
    })

    it('leaves it out for a qr payment from the pooled account', () => {
        withIntl(<ProviderRow providerId="manteca-ar" pooledAccount />)
        const sheet = openSheet('Manteca')
        expect(within(sheet).queryByText(relationship)).not.toBeInTheDocument()
    })
})

describe('ProviderNote', () => {
    it('names the card issuer on the card screen', () => {
        withIntl(<ProviderNote providerId="third-national" label="cardIssuer" />)
        expect(screen.getByText('Card issuer: Third National')).toBeInTheDocument()
    })

    it('names the account provider', () => {
        withIntl(<ProviderNote providerId="bridge-us" label="accountProvider" />)
        expect(screen.getByText('Account provider: Bridge')).toBeInTheDocument()
    })

    it('shows the pooled account line when asked', () => {
        withIntl(<ProviderNote providerId="manteca-br" pooledAccount />)
        expect(screen.getByText('Provider: Manteca')).toBeInTheDocument()
        const sheet = openSheet('Manteca')
        expect(within(sheet).getByText("Peanut's account at Manteca")).toBeInTheDocument()
        expect(within(sheet).getByText('CNPJ 63.653.001/0001-55')).toBeInTheDocument()
    })
})
