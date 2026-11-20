jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import type { ProviderId } from '@/types/provider.types'
import { PROVIDERS } from '@/constants/providers.consts'
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
        ['cardProvider', 'Card provider'],
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
                'Regulator and license',
                'Role',
                'How it works',
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
                'Regulator and license',
                'Role',
                'How it works',
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
                'Regulator and license',
                'Role',
                'How it works',
                "Peanut's role",
                'Terms',
                'Privacy',
                'Support',
            ],
        ],
        ['manteca-br', 'Manteca', ['Role', 'How it works', "Peanut's role", 'Terms', 'Privacy', 'Support']],
        ['rhino', 'Rhino.fi', ['Legal name', 'Role', 'How it works', "Peanut's role", 'Terms', 'Privacy']],
        [
            'third-national',
            'Rain',
            [
                'Legal name',
                'Registered office',
                'Registration',
                'Role',
                'Program manager',
                'How it works',
                "Peanut's role",
                'Privacy',
                'Support',
            ],
        ],
        ['bridge', 'Bridge', ['Role', 'How it works', "Peanut's role", 'Terms']],
    ])('%s prints its verified rows in order', (id, brand, labels) => {
        withIntl(<ProviderRow providerId={id} />)
        expect(rowLabels(openSheet(brand))).toEqual(labels)
    })

    it('fills role, execution and peanut rows from the catalog', () => {
        withIntl(<ProviderRow providerId="bridge-us" />)
        const sheet = openSheet('Bridge')
        // the role also names the dialog for screen readers, so read it from its row
        const roleRow = within(sheet).getByText('Role').closest('.border-dashed') as HTMLElement
        expect(roleRow).toHaveTextContent('Provides bank details and bank transfers')
        expect(
            within(sheet).getByText('Bridge handles the bank transfer; you control your Peanut wallet')
        ).toBeInTheDocument()
        expect(
            within(sheet).getByText('Peanut provides the self-custodial wallet software, not the transfer service.')
        ).toBeInTheDocument()
        expect(within(sheet).queryByRole('status')).not.toBeInTheDocument()
    })
})

// Each entry reads its own execution line: no entry borrows another's, so a new provider needs
// only its registry entry and its copy.
describe('ProviderSheet execution line', () => {
    it.each(Object.values(PROVIDERS).map((record) => [record.id, record.role, record.brand] as const))(
        '%s reads the execution line of its own role (%s)',
        (id, role, brand) => {
            withIntl(<ProviderRow providerId={id} />)
            const line = (messages.provider.execution as Record<string, string>)[role]
            expect(line).toBeDefined()
            expect(within(openSheet(brand)).getByText(line.replace('{brand}', brand))).toBeInTheDocument()
        }
    )
})

describe('ProviderFinePrint', () => {
    it('reads "Card provider · Rain" on the card and keeps the issuer inside the sheet', () => {
        withIntl(<ProviderFinePrint providerId="third-national" label="cardProvider" />)
        expect(screen.getByText('Card provider · Rain')).toBeInTheDocument()
        expect(screen.queryByText(/Third National/)).not.toBeInTheDocument()
        const sheet = openSheet('Rain')
        expect(within(sheet).getByRole('heading', { name: 'Rain' })).toBeInTheDocument()
        expect(within(sheet).getByText('Nimbus LLC, doing business as Third National')).toBeInTheDocument()
        expect(within(sheet).getByText('Third National issues and settles')).toBeInTheDocument()
        expect(
            within(sheet).getByText('Peanut makes the wallet app. It is not the card issuer or a lender.')
        ).toBeInTheDocument()
    })

    it('reads "Provider · Manteca" with the (?)', () => {
        withIntl(<ProviderFinePrint providerId="manteca-br" />)
        expect(screen.getByText('Provider · Manteca')).toBeInTheDocument()
        const sheet = openSheet('Manteca')
        // brand only in brazil: no legal name, office or CNPJ
        expect(within(sheet).queryByText(/CNPJ/)).not.toBeInTheDocument()
    })

    it('says Manteca handles the payment, since the brazil sheet also opens from qr pay', () => {
        withIntl(<ProviderFinePrint providerId="manteca-br" />)
        const sheet = openSheet('Manteca')
        expect(
            within(sheet).getByText('Manteca handles the local payment and the currency conversion')
        ).toBeInTheDocument()
        expect(within(sheet).queryByText('Paid from your bank app')).not.toBeInTheDocument()
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

    it('keeps the issuer in the card terms wording, prospective before acceptance', () => {
        withIntl(<ProviderRow providerId="third-national" label="cardProvider" prospective />)
        expect(
            within(openSheet('Rain')).getByText(
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
