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
        documentRefusals,
        documentTypeRefusals,
        features = { qr: true, local: false, card: false, bank: true },
    }: {
        types?: string[]
        proofOfAddressIdCountries?: string[]
        documentRefusals?: KycDocumentPlan['documentRefusals']
        documentTypeRefusals?: KycDocumentPlan['documentTypeRefusals']
        features?: KycDocumentPlan['features']
    } = {}
) =>
    ({
        available: true,
        activeAttemptId: null,
        policyVersion: 'test',
        flow: 'verify-once',
        proofOfAddress: null,
        proofOfAddressIdCountries,
        documentRefusals,
        documentTypeRefusals,
        features,
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
    nationality = null,
    onContinue = jest.fn(),
    onChangeResidence,
}: {
    documentPlan: KycDocumentPlan
    residence: string
    nationality?: string | null
    onContinue?: jest.Mock
    onChangeResidence?: jest.Mock
}) {
    renderWithIntl(
        <IdentityDocumentScreen
            plan={documentPlan}
            residence={residence}
            nationality={nationality}
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
    it('lists the permit from the residence and the passport and ID from the nationality; a tap opens that document', () => {
        const onContinue = render({ documentPlan: plan(['DE', 'ES']), residence: 'ES', nationality: 'DE' })
        expect(screen.getByText(/Which document/)).toBeInTheDocument()
        expect(option('RESIDENCE_PERMIT', 'ES')).toHaveTextContent('Issued by Spain')
        expect(option('PASSPORT', 'DE')).toHaveTextContent('Issued by Germany')
        expect(option('ID_CARD', 'DE')).toBeInTheDocument()
        fireEvent.click(option('PASSPORT', 'DE')!)
        expect(onContinue).toHaveBeenCalledWith({ type: 'PASSPORT', issuingCountry: 'DE' })
    })

    // A nationality that only defaulted to the residence must not hide the permit the user holds.
    it('a nationality equal to the residence still lists its residence permit', () => {
        render({ documentPlan: plan(['ES']), residence: 'ES', nationality: 'ES' })
        expect(option('RESIDENCE_PERMIT', 'ES')).toBeInTheDocument()
        expect(option('PASSPORT', 'ES')).toBeInTheDocument()
    })

    it('without a nationality answer, every document is issued by the residence', () => {
        render({ documentPlan: plan(['US']), residence: 'US' })
        expect(option('RESIDENCE_PERMIT', 'US')).toBeInTheDocument()
        expect(option('PASSPORT', 'US')).toBeInTheDocument()
        expect(option('ID_CARD', 'US')).toBeInTheDocument()
    })

    it('leaves out a document or a country the plan does not accept', () => {
        render({ documentPlan: plan(['ES'], { types: ['PASSPORT'] }), residence: 'ES', nationality: 'DE' })
        expect(option('PASSPORT', 'DE')).toBeNull()
        expect(option('ID_CARD', 'DE')).toBeNull()
        expect(option('RESIDENCE_PERMIT', 'ES')).toBeNull()
    })

    it('says a proof of address follows for an ID country that needs one', () => {
        render({
            documentPlan: plan(['KZ', 'RU'], { proofOfAddressIdCountries: ['RU'] }),
            residence: 'KZ',
            nationality: 'RU',
        })
        expect(option('PASSPORT', 'RU')).toHaveTextContent('Issued by Russia. You’ll also add a proof of address.')
        expect(option('RESIDENCE_PERMIT', 'KZ')).not.toHaveTextContent('proof of address')
    })

    it('names both countries when the plan takes no document from either, instead of an empty list', () => {
        render({ documentPlan: plan(['US']), residence: 'BO', nationality: 'GB' })
        expect(screen.getByTestId('verify-id-none-accepted')).toHaveTextContent(
            'We can’t verify documents issued by United Kingdom or Bolivia yet.'
        )
        expect(screen.queryByTestId('verify-id-other')).toBeNull()
    })

    it('hides Other document when it holds nothing', () => {
        render({ documentPlan: plan(['GB'], { types: ['PASSPORT'] }), residence: 'BO', nationality: 'GB' })
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
        const onContinue = render({ documentPlan: plan(['DE', 'ES']), residence: 'ES', nationality: 'DE' })
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
        render({ documentPlan: plan(['DE', 'ES', 'PL']), residence: 'ES', nationality: 'DE' })
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
            nationality: 'UA',
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
            nationality: 'UA',
        })
        expect(screen.getByTestId('verify-id-option-TEMPORARY_PROTECTION-PL')).toHaveTextContent('proof of address')
    })

    it('stays under Other documents for anyone but a Ukrainian', () => {
        render({ documentPlan: withProtection(['PL']), residence: 'PL', nationality: 'DE' })
        expect(option('TEMPORARY_PROTECTION', 'PL')).toBeNull()
        fireEvent.click(screen.getByTestId('verify-id-other'))
        expect(
            within(screen.getByTestId('verify-id-other-drawer')).getByTestId('verify-id-option-TEMPORARY_PROTECTION-PL')
        ).toBeInTheDocument()
    })

    // The server's plan decides who is offered it; the app keeps no rule of its own.
    it('is offered whenever the server plan carries it, with no tie to Ukraine on the device', () => {
        render({ documentPlan: withProtection(['PL']), residence: 'PL', nationality: null })
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

// Slava, 2026-10-26: the nationality's own passport and ID stay in view, greyed, when the route refuses them.
describe('IdentityDocumentScreen: a nationality whose IDs the route refuses', () => {
    it('shows its passport and ID card greyed, not tappable, as not accepted', () => {
        const onContinue = render({ documentPlan: plan(['PT']), residence: 'PT', nationality: 'UA' })
        for (const type of ['PASSPORT', 'ID_CARD']) {
            const row = screen.getByTestId(`verify-id-refused-${type}-UA`)
            expect(row).toHaveTextContent('Issued by Ukraine. Can’t be used. Not accepted.')
            expect(row).toHaveAttribute('aria-disabled', 'true')
            fireEvent.click(row)
        }
        expect(onContinue).not.toHaveBeenCalled()
        expect(option('RESIDENCE_PERMIT', 'PT')).toBeInTheDocument()
    })

    it('shows none when the route takes the nationality’s IDs', () => {
        render({ documentPlan: plan(['PT', 'UA']), residence: 'PT', nationality: 'UA' })
        expect(screen.queryByTestId('verify-id-refused-PASSPORT-UA')).toBeNull()
        expect(option('PASSPORT', 'UA')).toBeInTheDocument()
    })
})

// Slava, 2026-10-27: a Venezuelan in Argentina was offered their passport with nothing said about the card it closes.
describe('IdentityDocumentScreen: an ID that closes features the user asked for', () => {
    const NONE = { qr: false, local: false, card: false, bank: false }
    const venezuelan = (features: KycDocumentPlan['features']) =>
        plan(['AR', 'VE'], { documentRefusals: { VE: ['card'] }, features })

    it('says what a partly refused ID closes, and asks before Sumsub opens', () => {
        const onContinue = render({
            documentPlan: venezuelan({ ...NONE, qr: true, card: true }),
            residence: 'AR',
            nationality: 'VE',
        })
        const passport = option('PASSPORT', 'VE')!
        expect(passport).toHaveTextContent('Issued by Venezuela. The Peanut card isn’t available with this document.')
        expect(option('RESIDENCE_PERMIT', 'AR')).not.toHaveTextContent('isn’t available')
        fireEvent.click(passport)
        expect(onContinue).not.toHaveBeenCalled()
        const drawer = within(screen.getByTestId('verify-id-limited-drawer'))
        expect(drawer.getByText('Continue with this document?')).toBeInTheDocument()
        expect(drawer.getByText('The Peanut card isn’t available with this document.')).toBeInTheDocument()
        expect(drawer.getByText('A document issued by Argentina doesn’t have this limit.')).toBeInTheDocument()
        fireEvent.click(drawer.getByTestId('verify-id-limited-continue'))
        expect(onContinue).toHaveBeenCalledWith({ type: 'PASSPORT', issuingCountry: 'VE' })
    })

    it('Choose another document closes the question and opens nothing', () => {
        const onContinue = render({
            documentPlan: venezuelan({ ...NONE, qr: true, card: true }),
            residence: 'AR',
            nationality: 'VE',
        })
        fireEvent.click(option('ID_CARD', 'VE')!)
        fireEvent.click(screen.getByTestId('verify-id-limited-back'))
        expect(onContinue).not.toHaveBeenCalled()
        fireEvent.click(option('RESIDENCE_PERMIT', 'AR')!)
        expect(onContinue).toHaveBeenCalledWith({ type: 'RESIDENCE_PERMIT', issuingCountry: 'AR' })
    })

    it('greys out an ID that closes every feature asked for, in the list and under Other documents', () => {
        const onContinue = render({
            documentPlan: venezuelan({ ...NONE, card: true }),
            residence: 'AR',
            nationality: 'VE',
        })
        for (const type of ['PASSPORT', 'ID_CARD']) {
            const row = screen.getByTestId(`verify-id-refused-${type}-VE`)
            expect(row).toHaveTextContent('Issued by Venezuela. Can’t be used for what you picked.')
            expect(row).toHaveAttribute('aria-disabled', 'true')
            fireEvent.click(row)
        }
        expect(option('PASSPORT', 'VE')).toBeNull()
        fireEvent.click(screen.getByTestId('verify-id-other'))
        const drawer = within(screen.getByTestId('verify-id-other-drawer'))
        expect(drawer.getByTestId('verify-id-refused-DRIVERS-VE')).toHaveAttribute('aria-disabled', 'true')
        expect(screen.queryByTestId('verify-id-limited-drawer')).toBeNull()
        expect(onContinue).not.toHaveBeenCalled()
        fireEvent.click(drawer.getByTestId('verify-id-option-DRIVERS-AR'))
        expect(onContinue).toHaveBeenCalledWith({ type: 'DRIVERS', issuingCountry: 'AR' })
    })

    it('shows the greyed IDs rather than an empty list when every offered ID closes everything', () => {
        render({
            documentPlan: plan(['VE'], { documentRefusals: { VE: ['card'] }, features: { ...NONE, card: true } }),
            residence: 'VE',
        })
        expect(screen.getByTestId('verify-id-refused-PASSPORT-VE')).toBeInTheDocument()
        expect(screen.queryByTestId('verify-id-none-accepted')).toBeNull()
    })

    it('opens an ID straight away when the plan names no refusal for it', () => {
        const onContinue = render({
            documentPlan: plan(['AR', 'VE'], { features: { ...NONE, qr: true, card: true } }),
            residence: 'AR',
            nationality: 'VE',
        })
        fireEvent.click(option('PASSPORT', 'VE')!)
        expect(onContinue).toHaveBeenCalledWith({ type: 'PASSPORT', issuingCountry: 'VE' })
        expect(screen.queryByTestId('verify-id-limited-drawer')).toBeNull()
    })
})

// The old card and Manteca levels refuse some driver's licences in Sumsub; the API keeps them refused per type.
describe("IdentityDocumentScreen: a driver's licence the API refuses for a feature", () => {
    const NONE = { qr: false, local: false, card: false, bank: false }
    const german = (features: KycDocumentPlan['features']) =>
        plan(['DE'], { documentTypeRefusals: { DE: { DRIVERS: ['card'] } }, features })

    it('greys out a German licence for the card alone and keeps the German ID card', () => {
        const onContinue = render({ documentPlan: german({ ...NONE, card: true }), residence: 'DE' })
        fireEvent.click(screen.getByTestId('verify-id-other'))
        const drawer = within(screen.getByTestId('verify-id-other-drawer'))
        expect(drawer.getByTestId('verify-id-refused-DRIVERS-DE')).toHaveAttribute('aria-disabled', 'true')
        expect(drawer.queryByTestId('verify-id-option-DRIVERS-DE')).toBeNull()
        fireEvent.click(option('ID_CARD', 'DE')!)
        expect(onContinue).toHaveBeenCalledWith({ type: 'ID_CARD', issuingCountry: 'DE' })
    })

    it('says a German licence closes the card when the bank is asked too', () => {
        const onContinue = render({ documentPlan: german({ ...NONE, card: true, bank: true }), residence: 'DE' })
        fireEvent.click(screen.getByTestId('verify-id-other'))
        const licence = within(screen.getByTestId('verify-id-other-drawer')).getByTestId('verify-id-option-DRIVERS-DE')
        expect(licence).toHaveTextContent('The Peanut card isn’t available with this document.')
        fireEvent.click(licence)
        expect(onContinue).not.toHaveBeenCalled()
        expect(
            within(screen.getByTestId('verify-id-limited-drawer')).getByText('Continue with this document?')
        ).toBeInTheDocument()
    })

    it('greys out an Argentine licence for a Manteca local account alone', () => {
        render({
            documentPlan: plan(['AR'], {
                documentTypeRefusals: { AR: { DRIVERS: ['local'] } },
                features: { ...NONE, local: true },
            }),
            residence: 'AR',
        })
        fireEvent.click(screen.getByTestId('verify-id-other'))
        expect(
            within(screen.getByTestId('verify-id-other-drawer')).getByTestId('verify-id-refused-DRIVERS-AR')
        ).toHaveAttribute('aria-disabled', 'true')
        expect(option('ID_CARD', 'AR')).toBeInTheDocument()
    })
})
