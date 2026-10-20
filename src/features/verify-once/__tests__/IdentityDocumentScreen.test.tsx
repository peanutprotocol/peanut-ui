import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { IdentityDocumentScreen } from '../components/IdentityDocumentScreen'

const plan = (countries: string[], proofOfAddressIdCountries?: string[]) =>
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
                documents: [
                    {
                        key: 'identity',
                        code: 'IDENTITY',
                        requiredBy: ['SUMSUB'],
                        types: ['PASSPORT', 'RESIDENCE_PERMIT'],
                        countries,
                    },
                ],
            },
        ],
    }) as KycDocumentPlan

const render = (documentPlan: KycDocumentPlan, residence: string) =>
    renderWithIntl(
        <IdentityDocumentScreen
            plan={documentPlan}
            residence={residence}
            progress={{ current: 1, total: 2 }}
            busy={false}
            error={null}
            onBack={jest.fn()}
            onContinue={jest.fn()}
        />
    )

describe('IdentityDocumentScreen: proof of address', () => {
    it('lists a proof of address for an ID country that needs one, and says a local permit avoids it', () => {
        render(plan(['KZ', 'RU'], ['RU']), 'KZ')
        expect(screen.queryByTestId('verify-id-proof-of-address')).toBeNull()

        fireEvent.click(screen.getByTestId('verify-id-country'))
        fireEvent.click(screen.getByLabelText('Russia'))

        expect(screen.getByTestId('verify-id-proof-of-address')).toHaveTextContent('Proof of address')
        expect(screen.getByTestId('verify-id-proof-of-address')).toHaveTextContent('With an ID from Russia')
        expect(screen.getByText('A residence permit from Kazakhstan doesn’t need one.')).toBeInTheDocument()
    })

    it('lists nothing for an ID country the plan does not name', () => {
        render(plan(['DE'], ['RU']), 'KZ')
        expect(screen.queryByTestId('verify-id-proof-of-address')).toBeNull()
    })

    it('lists nothing when the API sends no list', () => {
        render(plan(['RU']), 'KZ')
        expect(screen.queryByTestId('verify-id-proof-of-address')).toBeNull()
    })
})
