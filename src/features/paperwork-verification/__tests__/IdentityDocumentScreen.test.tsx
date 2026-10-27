import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { IdentityDocumentScreen } from '../components/IdentityDocumentScreen'

jest.mock('../components/IdCardScanAnimation', () => ({ IdCardScanAnimation: () => null }))

const plan = (
    countries: string[],
    {
        types = ['PASSPORT', 'ID_CARD', 'RESIDENCE_PERMIT', 'DRIVERS'],
        proofOfAddressIdCountries,
    }: { types?: string[]; proofOfAddressIdCountries?: string[] } = {}
) =>
    ({
        available: true,
        activeAttemptId: null,
        policyVersion: 'test',
        flow: 'verify-once',
        proofOfAddress: null,
        proofOfAddressIdCountries,
        features: { qr: true, local: false, card: false, bank: true },
        routes: [
            {
                id: 'base',
                documents: [{ key: 'identity', code: 'IDENTITY', requiredBy: ['SUMSUB'], types, countries }],
            },
        ],
    }) as KycDocumentPlan

function render({
    documentPlan,
    residence,
    citizenship = null,
    onContinue = jest.fn(),
    onChangeResidence,
}: {
    documentPlan: KycDocumentPlan
    residence: string
    citizenship?: string | null
    onContinue?: jest.Mock
    onChangeResidence?: jest.Mock
}) {
    renderWithIntl(
        <IdentityDocumentScreen
            plan={documentPlan}
            residence={residence}
            citizenship={citizenship}
            busy={false}
            error={null}
            onBack={jest.fn()}
            onContinue={onContinue}
            onChangeResidence={onChangeResidence}
        />
    )
    return onContinue
}

const option = (type: string, country: string) => screen.queryByTestId(`verify-id-option-${type}-${country}`)

describe('IdentityDocumentScreen: the list', () => {
    it('lists the permit from the residence and the passport and ID from the citizenship; a tap opens that document', () => {
        const onContinue = render({ documentPlan: plan(['DE', 'ES']), residence: 'ES', citizenship: 'DE' })
        expect(screen.getByText(/Which document/)).toBeInTheDocument()
        expect(option('RESIDENCE_PERMIT', 'ES')).toHaveTextContent('Issued by Spain')
        expect(option('PASSPORT', 'DE')).toHaveTextContent('Issued by Germany')
        expect(option('ID_CARD', 'DE')).toBeInTheDocument()
        fireEvent.click(option('PASSPORT', 'DE')!)
        expect(onContinue).toHaveBeenCalledWith({ type: 'PASSPORT', issuingCountry: 'DE' })
    })

    // A citizenship that only defaulted to the residence must not hide the permit the user holds.
    it('a citizenship equal to the residence still lists its residence permit', () => {
        render({ documentPlan: plan(['ES']), residence: 'ES', citizenship: 'ES' })
        expect(option('RESIDENCE_PERMIT', 'ES')).toBeInTheDocument()
        expect(option('PASSPORT', 'ES')).toBeInTheDocument()
    })

    it('without a citizenship answer, every document is issued by the residence', () => {
        render({ documentPlan: plan(['US']), residence: 'US' })
        expect(option('RESIDENCE_PERMIT', 'US')).toBeInTheDocument()
        expect(option('PASSPORT', 'US')).toBeInTheDocument()
        expect(option('ID_CARD', 'US')).toBeInTheDocument()
    })

    it('leaves out a document or a country the plan does not accept', () => {
        render({ documentPlan: plan(['ES'], { types: ['PASSPORT'] }), residence: 'ES', citizenship: 'DE' })
        expect(option('PASSPORT', 'DE')).toBeNull()
        expect(option('ID_CARD', 'DE')).toBeNull()
        expect(option('RESIDENCE_PERMIT', 'ES')).toBeNull()
    })

    it('says a proof of address follows for an ID country that needs one', () => {
        render({
            documentPlan: plan(['KZ', 'RU'], { proofOfAddressIdCountries: ['RU'] }),
            residence: 'KZ',
            citizenship: 'RU',
        })
        expect(option('PASSPORT', 'RU')).toHaveTextContent('Issued by Russia. You’ll also add a proof of address.')
        expect(option('RESIDENCE_PERMIT', 'KZ')).not.toHaveTextContent('proof of address')
    })

    it('names both countries when the plan takes no document from either, instead of an empty list', () => {
        render({ documentPlan: plan(['US']), residence: 'BO', citizenship: 'GB' })
        expect(screen.getByTestId('verify-id-none-accepted')).toHaveTextContent(
            'We can’t verify documents issued by United Kingdom or Bolivia yet.'
        )
        expect(screen.queryByTestId('verify-id-other')).toBeNull()
    })

    it('hides Other document when it holds nothing', () => {
        render({ documentPlan: plan(['GB'], { types: ['PASSPORT'] }), residence: 'BO', citizenship: 'GB' })
        expect(option('PASSPORT', 'GB')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-id-other')).toBeNull()
        expect(screen.queryByTestId('verify-id-none-accepted')).toBeNull()
    })

    it('Change residence opens the residence change', () => {
        const onChangeResidence = jest.fn()
        render({ documentPlan: plan(['ES']), residence: 'ES', onChangeResidence })
        fireEvent.click(screen.getByTestId('verify-id-change-residence'))
        expect(onChangeResidence).toHaveBeenCalled()
    })
})

describe('IdentityDocumentScreen: other documents', () => {
    it('lists the licences and a dual resident’s documents from the residence', () => {
        const onContinue = render({ documentPlan: plan(['DE', 'ES']), residence: 'ES', citizenship: 'DE' })
        fireEvent.click(screen.getByTestId('verify-id-other'))
        const drawer = within(screen.getByTestId('verify-id-other-drawer'))
        expect(drawer.getByTestId('verify-id-option-DRIVERS-ES')).toBeInTheDocument()
        expect(drawer.getByTestId('verify-id-option-DRIVERS-DE')).toBeInTheDocument()
        expect(drawer.getByTestId('verify-id-option-PASSPORT-ES')).toBeInTheDocument()
        expect(drawer.getByText('Visas, work permits and student cards can’t be used to verify your ID.')).toBeVisible()
        fireEvent.click(drawer.getByTestId('verify-id-option-DRIVERS-ES'))
        expect(onContinue).toHaveBeenCalledWith({ type: 'DRIVERS', issuingCountry: 'ES' })
    })

    // Slava, 2026-10-26: no picking a document from a country of the user's choice.
    it('offers no document from another country', () => {
        render({ documentPlan: plan(['DE', 'ES', 'PL']), residence: 'ES', citizenship: 'DE' })
        fireEvent.click(screen.getByTestId('verify-id-other'))
        expect(screen.queryByText('A document from another country')).toBeNull()
        expect(screen.queryByTestId('verify-id-another-country')).toBeNull()
        expect(option('PASSPORT', 'PL')).toBeNull()
    })
})

describe('IdentityDocumentScreen: temporary protection', () => {
    const withProtection = (countries: string[], proofOfAddress = false) =>
        ({
            ...plan(['PL', 'UA']),
            temporaryProtection: { countries, until: '2027-03-04', proofOfAddress },
        }) as KycDocumentPlan

    // Slava, 2026-10-26: a Ukrainian holds it where they live, so it leads their list.
    it('leads the main list for a Ukrainian, issued where they live, and sends it as picked', () => {
        const onContinue = render({
            documentPlan: withProtection(['PL']),
            residence: 'PL',
            citizenship: 'UA',
        })
        const row = screen.getByTestId('verify-id-option-TEMPORARY_PROTECTION-PL')
        expect(screen.getAllByTestId(/^verify-id-option-/)[0]).toBe(row)
        expect(row).toHaveTextContent('Temporary protection for Ukrainians')
        expect(row).toHaveTextContent('Issued by Poland')
        expect(row).not.toHaveTextContent('paper')
        fireEvent.click(screen.getByTestId('verify-id-other'))
        expect(
            within(screen.getByTestId('verify-id-other-drawer')).queryByTestId(
                'verify-id-option-TEMPORARY_PROTECTION-PL'
            )
        ).toBeNull()
        fireEvent.click(row)
        expect(onContinue).toHaveBeenCalledWith({ type: 'TEMPORARY_PROTECTION', issuingCountry: 'PL' })
    })

    // Slava, 2026-10-26: a bank user verifying with it gives a proof of address too, and the row says so.
    it('says when the sheet brings a proof of address', () => {
        render({
            documentPlan: withProtection(['PL'], true),
            residence: 'PL',
            citizenship: 'UA',
        })
        expect(screen.getByTestId('verify-id-option-TEMPORARY_PROTECTION-PL')).toHaveTextContent('proof of address')
    })

    it('stays under Other documents for anyone but a Ukrainian', () => {
        render({ documentPlan: withProtection(['PL']), residence: 'PL', citizenship: 'DE' })
        expect(option('TEMPORARY_PROTECTION', 'PL')).toBeNull()
        fireEvent.click(screen.getByTestId('verify-id-other'))
        expect(
            within(screen.getByTestId('verify-id-other-drawer')).getByTestId('verify-id-option-TEMPORARY_PROTECTION-PL')
        ).toBeInTheDocument()
    })

    // The server's plan decides who is offered it; the app keeps no rule of its own.
    it('is offered whenever the server plan carries it, with no tie to Ukraine on the device', () => {
        render({ documentPlan: withProtection(['PL']), residence: 'PL', citizenship: null })
        fireEvent.click(screen.getByTestId('verify-id-other'))
        expect(
            within(screen.getByTestId('verify-id-other-drawer')).getByTestId('verify-id-option-TEMPORARY_PROTECTION-PL')
        ).toBeInTheDocument()
    })

    it('is not offered when the API sends no temporary protection', () => {
        render({ documentPlan: plan(['PL', 'UA']), residence: 'PL' })
        fireEvent.click(screen.getByTestId('verify-id-other'))
        expect(screen.queryByText('Temporary protection for Ukrainians')).toBeNull()
    })
})

// Slava, 2026-10-26: the citizenship's own passport and ID stay in view, greyed, when the route refuses them.
describe('IdentityDocumentScreen: a citizenship whose IDs the route refuses', () => {
    it('shows its passport and ID card greyed, not tappable, as not accepted', () => {
        const onContinue = render({ documentPlan: plan(['PT']), residence: 'PT', citizenship: 'UA' })
        for (const type of ['PASSPORT', 'ID_CARD']) {
            const row = screen.getByTestId(`verify-id-refused-${type}-UA`)
            expect(row).toHaveTextContent('Issued by Ukraine. Can’t be used. Not accepted.')
            expect(row).toHaveAttribute('aria-disabled', 'true')
            fireEvent.click(row)
        }
        expect(onContinue).not.toHaveBeenCalled()
        expect(option('RESIDENCE_PERMIT', 'PT')).toBeInTheDocument()
    })

    it('shows none when the route takes the citizenship’s IDs', () => {
        render({ documentPlan: plan(['PT', 'UA']), residence: 'PT', citizenship: 'UA' })
        expect(screen.queryByTestId('verify-id-refused-PASSPORT-UA')).toBeNull()
        expect(option('PASSPORT', 'UA')).toBeInTheDocument()
    })
})
