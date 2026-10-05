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
        expect(within(sheet).getByText('Peanut')).toBeInTheDocument()
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

describe('ProviderNote', () => {
    it('shows the pooled account line when asked', () => {
        withIntl(<ProviderNote providerId="manteca-br" pooledAccount />)
        expect(screen.getByText('Provider: Manteca')).toBeInTheDocument()
        const sheet = openSheet('Manteca')
        expect(within(sheet).getByText("Peanut's account at Manteca")).toBeInTheDocument()
        expect(within(sheet).getByText('CNPJ 63.653.001/0001-55')).toBeInTheDocument()
    })
})
