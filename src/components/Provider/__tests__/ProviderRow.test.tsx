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
        expect(within(sheet).getByText('VAT LU37059083')).toBeInTheDocument()
        fireEvent.click(within(sheet).getByRole('button', { name: /^View terms/ }))
        expect(openExternalUrl).toHaveBeenCalledWith('https://www.bridge.xyz/legal/eea-user-terms/bridge-building-s-a')
    })

    it.each([
        ['accountProvider', 'Account provider'],
        ['cardIssuer', 'Card issuer'],
    ] as const)('labels the row %s', (label, text) => {
        withIntl(<ProviderRow providerId="bridge-us" label={label} />)
        expect(screen.getByText(text)).toBeInTheDocument()
    })
})

// row labels in sheet order, as on the disclosure sheet design
const rowLabels = (sheet: HTMLElement) => Array.from(sheet.querySelectorAll('label')).map((label) => label.textContent)

describe('ProviderSheet rows', () => {
    it.each<[ProviderId, string, string[]]>([
        [
            'bridge-eea',
            'Bridge',
            [
                'Legal name',
                'Registered office',
                'Registration',
                'Tax ID',
                'Regulator and licence',
                'Role',
                'How this executes',
                "Peanut's role",
                'Terms',
                'Privacy',
                'Support',
            ],
        ],
        [
            'bridge-us',
            'Bridge',
            [
                'Legal name',
                'Registered office',
                'Registration',
                'Regulator and licence',
                'Role',
                'How this executes',
                "Peanut's role",
                'Terms',
                'Privacy',
                'Support',
            ],
        ],
        [
            'manteca-ar',
            'Manteca',
            [
                'Legal name',
                'Registered office',
                'Tax ID',
                'Regulator and licence',
                'Role',
                'How this executes',
                "Peanut's role",
                'Terms',
                'Privacy',
                'Support',
            ],
        ],
        [
            'manteca-br',
            'Manteca',
            [
                'Legal name',
                'Registered office',
                'Tax ID',
                'Role',
                'How this executes',
                "Peanut's role",
                'Terms',
                'Privacy',
                'Support',
            ],
        ],
        ['rhino', 'Rhino.fi', ['Legal name', 'Role', 'How this executes', "Peanut's role", 'Terms', 'Privacy']],
        [
            'third-national',
            'Third National',
            [
                'Legal name',
                'Registered office',
                'Registration',
                'Role',
                'Program manager',
                'How this executes',
                "Peanut's role",
                'Privacy',
                'Support',
            ],
        ],
        ['bridge', 'Bridge', ['Role', 'How this executes', "Peanut's role", 'Terms']],
    ])('%s prints its verified rows in order', (id, brand, labels) => {
        withIntl(<ProviderRow providerId={id} />)
        expect(rowLabels(openSheet(brand))).toEqual(labels)
    })

    it('fills role, execution and peanut rows from the catalog', () => {
        withIntl(<ProviderRow providerId="bridge-us" />)
        const sheet = openSheet('Bridge')
        // the role also names the dialog for screen readers, so read it from its row
        const roleRow = within(sheet).getByText('Role').closest('.border-dashed') as HTMLElement
        expect(roleRow).toHaveTextContent('Fiat on-ramp, off-ramp and account provider')
        expect(within(sheet).getByText('Signed by you, Bridge pays out')).toBeInTheDocument()
        expect(
            within(sheet).getByText('Self-custodial wallet software provider; not a party to provider trades')
        ).toBeInTheDocument()
        expect(within(sheet).queryByRole('status')).not.toBeInTheDocument()
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

describe('ProviderSheet relationship line', () => {
    const relationship = /You have a direct relationship/

    it('states the direct relationship when the user accepted the provider terms', () => {
        withIntl(<ProviderRow providerId="bridge-eea" />)
        expect(within(openSheet('Bridge')).getByText(relationship)).toBeInTheDocument()
    })

    it('speaks of the relationship as ahead before the user accepts', () => {
        withIntl(<ProviderRow providerId="bridge-eea" prospective />)
        const sheet = openSheet('Bridge')
        expect(
            within(sheet).getByText('When you accept, your relationship is directly with Bridge, under their terms.')
        ).toBeInTheDocument()
        expect(within(sheet).queryByText(relationship)).not.toBeInTheDocument()
    })

    it('uses the card terms wording for the card issuer, prospective before acceptance', () => {
        withIntl(<ProviderRow providerId="third-national" label="cardIssuer" prospective />)
        expect(
            within(openSheet('Third National')).getByText(
                'When you accept the card terms, your relationship is directly with Third National.'
            )
        ).toBeInTheDocument()
    })

    it('leaves it out for rhino, where peanut is the customer', () => {
        withIntl(<ProviderRow providerId="rhino" />)
        expect(within(openSheet('Rhino.fi')).queryByText(relationship)).not.toBeInTheDocument()
    })

    it("never discloses peanut's manteca account", () => {
        withIntl(<ProviderRow providerId="manteca-ar" />)
        const sheet = openSheet('Manteca')
        expect(within(sheet).getByText(relationship)).toBeInTheDocument()
        expect(within(sheet).queryByText(/Peanut's account|pool account|Paid from/)).not.toBeInTheDocument()
    })
})
