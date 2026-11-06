/**
 * Profile lists what sign-up and verification collected, read from Sumsub, the
 * address and the tax number included (Slava, 2026-11-05). A value the API did
 * not return says "Not stored at Peanut"; a row shows only for something
 * collected; no location row. The edit button lives here (2026-11-05).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { getKycDetails } from '@/app/actions/kyc-paperwork-verification'
import type { KycCollectedDetails } from '@/app/actions/types/kyc-paperwork-verification.types'
import { normalizeResidence } from '@/utils/residence-profile'
import { ProfileDetailsView } from '../ProfileDetails.view'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ rightElement }: { rightElement?: React.ReactNode }) => rightElement ?? null,
}))
jest.mock('@/app/actions/kyc-paperwork-verification', () => ({ getKycDetails: jest.fn() }))
const mockUser = {
    user: { userId: 'user-a', fullName: 'Ivan Petrenko', email: 'ivan@example.com' },
    residence: normalizeResidence({ declared: 'PT', declaredSecond: null, verified: 'PT' }),
}
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))

const details = (overrides: Partial<KycCollectedDetails> = {}): KycCollectedDetails => ({
    name: { first: null, last: null },
    nationality: 'UA',
    idNationality: null,
    document: { type: 'RESIDENCE_PERMIT', country: 'PT' },
    stored: {
        dateOfBirth: '1990-04-02',
        cityOfBirth: 'Odesa',
        phone: '+351912345678',
        occupation: 'airline_pilot_copilot_and_flight_engineer',
        annualSalary: '25k_50k',
        bankPurpose: 'investment_purposes',
        isPep: 'no',
        isFatca: 'yes',
    },
    heldBySumsub: ['taxId', 'address'],
    ...overrides,
})

const render = () =>
    renderWithIntl(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <ProfileDetailsView />
        </QueryClientProvider>
    )

const rowValue = (label: string) => {
    const row = screen.getByText(label).closest('.ds-data-row') as HTMLElement
    return within(row).getByText((_, element) => !!element?.classList.contains('ds-data-row-value')).textContent
}

beforeEach(() => {
    mockUser.user = { userId: 'user-a', fullName: 'Ivan Petrenko', email: 'ivan@example.com' }
    jest.mocked(getKycDetails).mockReset().mockResolvedValue(details())
    mockUser.residence = normalizeResidence({ declared: 'PT', declaredSecond: null, verified: 'PT' })
})

describe('ProfileDetailsView', () => {
    it("shows Peanut's records and marks what only Sumsub holds", async () => {
        render()
        expect(await screen.findByText('Nationality')).toBeInTheDocument()
        expect(rowValue('Name')).toBe('Ivan')
        expect(rowValue('Surname')).toBe('Petrenko')
        expect(rowValue('Email')).toBe('ivan@example.com')
        expect(rowValue('Verified residence')).toBe('Portugal')
        expect(rowValue('ID document')).toBe('Residence permit, Portugal')
        for (const label of ['Tax number', 'Address']) expect(rowValue(label)).toBe('Not stored at Peanut')
    })

    it('shows the answers Peanut keeps in words', async () => {
        render()
        expect(await screen.findByText('Airline pilot, copilot, and flight engineer')).toBeInTheDocument()
        expect(rowValue('Nationality')).toBe('Ukraine')
        expect(rowValue('Date of birth')).toBe('April 2, 1990')
        expect(rowValue('City of birth')).toBe('Odesa')
        expect(rowValue('Phone number')).toBe('+351912345678')
        expect(rowValue('Yearly income')).toBe('$25,000–$49,999')
        expect(rowValue('Account use')).toBe('Investing')
        expect(rowValue('Public office')).toBe('No')
        expect(rowValue('US citizen or tax resident')).toBe('Yes')
    })

    it('an answer Peanut could not copy yet still reads as held by Sumsub', async () => {
        jest.mocked(getKycDetails).mockResolvedValue(
            details({ nationality: null, stored: {}, heldBySumsub: ['dateOfBirth', 'taxId'] })
        )
        render()
        expect(await screen.findByText('Date of birth')).toBeInTheDocument()
        expect(rowValue('Date of birth')).toBe('Not stored at Peanut')
        expect(screen.queryByText('Nationality')).toBeNull()
    })

    // Slava, 2026-10-26: what the database holds shows as a value, never as "Not stored".
    it('shows the verified name and the nationality that Peanut stores', async () => {
        jest.mocked(getKycDetails).mockResolvedValue(
            details({ name: { first: 'Іван', last: 'Петренко' }, nationality: 'UA', heldBySumsub: ['taxId'] })
        )
        render()
        expect(await screen.findByText('Nationality')).toBeInTheDocument()
        expect(rowValue('Name')).toBe('Іван')
        expect(rowValue('Surname')).toBe('Петренко')
        expect(rowValue('Nationality')).toBe('Ukraine')
        expect(rowValue('Tax number')).toBe('Not stored at Peanut')
    })

    it('hides what was never collected, the funding and spending methods, and location', async () => {
        render()
        await screen.findByText('Nationality')
        for (const label of ['Card use', 'Second residence', 'Employment', 'Sex', 'Marital status'])
            expect(screen.queryByText(label)).toBeNull()
        expect(screen.queryByText(/location/i)).toBeNull()
        expect(screen.queryByText(/funding|spending method/i)).toBeNull()
    })

    it('names an unverified residence as declared', async () => {
        mockUser.residence = normalizeResidence({ declared: 'ES', declaredSecond: 'PT', verified: null })
        render()
        expect(await screen.findByText('Declared residence')).toBeInTheDocument()
        expect(rowValue('Declared residence')).toBe('Spain')
        expect(rowValue('Second residence')).toBe('Portugal')
        expect(screen.queryByText('Verified residence')).toBeNull()
    })

    // Slava, 2026-10-27: the nationality given and the nationality the ID shows are two facts.
    it('shows the nationality given and the nationality on the ID as separate rows when they differ', async () => {
        jest.mocked(getKycDetails).mockResolvedValue(details({ nationality: 'UA', idNationality: 'PL' }))
        render()
        expect(await screen.findByText('Nationality on your ID')).toBeInTheDocument()
        expect(rowValue('Nationality')).toBe('Ukraine')
        expect(rowValue('Nationality on your ID')).toBe('Poland')
    })

    it('shows the nationality once when the ID names the one given', async () => {
        jest.mocked(getKycDetails).mockResolvedValue(details({ nationality: 'UA', idNationality: 'UA' }))
        render()
        expect(await screen.findByText('Nationality')).toBeInTheDocument()
        expect(rowValue('Nationality')).toBe('Ukraine')
        expect(screen.queryByText('Nationality on your ID')).toBeNull()
        expect(screen.getAllByText('Ukraine')).toHaveLength(1)
    })

    it("shows the ID's nationality when none was given", async () => {
        jest.mocked(getKycDetails).mockResolvedValue(details({ nationality: null, idNationality: 'PL' }))
        render()
        expect(await screen.findByText('Nationality on your ID')).toBeInTheDocument()
        expect(rowValue('Nationality on your ID')).toBe('Poland')
        expect(screen.queryByText('Nationality')).toBeNull()
    })

    it('leaves out the ID nationality row when the ID names none', async () => {
        render()
        await screen.findByText('Nationality')
        expect(screen.queryByText('Nationality on your ID')).toBeNull()
    })

    it('shows the address and the tax number Sumsub holds as values', async () => {
        jest.mocked(getKycDetails).mockResolvedValue(
            details({
                address: {
                    street: 'Rua Augusta',
                    buildingNumber: '12',
                    town: 'Lisboa',
                    postCode: '1100-053',
                    country: 'PT',
                },
                taxId: '123456789',
            })
        )
        render()
        expect(await screen.findByText('Address')).toBeInTheDocument()
        expect(rowValue('Address')).toBe('Rua Augusta 12, 1100-053 Lisboa, Portugal')
        expect(rowValue('Tax number')).toBe('123456789')
        expect(screen.getByText('123456789')).toHaveClass('ph-sensitive')
    })

    it('links to editing the profile from its header', async () => {
        render()
        expect(await screen.findByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile/edit')
    })

    it('an older API that only names the address says it is not stored at Peanut', async () => {
        jest.mocked(getKycDetails).mockResolvedValue(details({ heldBySumsub: ['address'] }))
        render()
        expect(await screen.findByText('Address')).toBeInTheDocument()
        expect(rowValue('Address')).toBe('Not stored at Peanut')
    })
})

describe('account-scoped KYC details', () => {
    it('never paints A’s cached city or phone while B’s read is pending', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
        const tree = () => (
            <QueryClientProvider client={client}>
                <ProfileDetailsView />
            </QueryClientProvider>
        )
        const first = renderWithIntl(tree())
        await screen.findByText('Odesa')
        first.unmount()
        mockUser.user = { userId: 'user-b', fullName: 'Maria Silva', email: 'b@example.com' }
        let finish!: (value: KycCollectedDetails) => void
        jest.mocked(getKycDetails).mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        renderWithIntl(tree())
        expect(screen.getByText('b@example.com')).toBeInTheDocument()
        expect(screen.queryByText('Odesa')).not.toBeInTheDocument()
        expect(screen.queryByText('+351912345678')).not.toBeInTheDocument()
        await act(async () => finish(details({ stored: { cityOfBirth: 'Lisbon', phone: '+351922222222' } })))
        expect(await screen.findByText('Lisbon')).toBeInTheDocument()
        expect(screen.queryByText('Odesa')).not.toBeInTheDocument()
        client.clear()
    })

    it('ignores A’s late detail response after switching the mounted view to B', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        let finishA!: (value: KycCollectedDetails) => void
        jest.mocked(getKycDetails).mockReturnValueOnce(
            new Promise((resolve) => {
                finishA = resolve
            })
        )
        const tree = () => (
            <QueryClientProvider client={client}>
                <ProfileDetailsView />
            </QueryClientProvider>
        )
        const view = renderWithIntl(tree())
        mockUser.user = { userId: 'user-b', fullName: 'Maria Silva', email: 'b@example.com' }
        jest.mocked(getKycDetails).mockResolvedValue(details({ stored: { cityOfBirth: 'Lisbon' } }))
        view.rerender(tree())
        expect(await screen.findByText('Lisbon')).toBeInTheDocument()
        await act(async () => finishA(details()))
        expect(screen.queryByText('Odesa')).not.toBeInTheDocument()
        expect(screen.queryByText('+351912345678')).not.toBeInTheDocument()
        expect(screen.getByText('Lisbon')).toBeInTheDocument()
        client.clear()
    })
})
