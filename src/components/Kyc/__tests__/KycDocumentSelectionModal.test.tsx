import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { KycDocumentSelectionModal } from '../KycDocumentSelectionModal'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'

jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button {...props}>{children}</button>
    ),
}))
const plan: KycDocumentPlan = {
    available: true,
    activeAttemptId: null,
    policyVersion: 'v1',
    features: { qr: true, local: false, bank: true, card: false },
    routes: [
        {
            id: 'identity-and-poa',
            documents: [
                {
                    key: 'identity',
                    code: 'IDENTITY',
                    types: ['PASSPORT', 'RESIDENCE_PERMIT'],
                    countries: ['PT'],
                    requiredBy: ['SUMSUB'],
                },
                {
                    key: 'address-proof',
                    code: 'PROOF_OF_ADDRESS',
                    types: ['BANK_STATEMENT'],
                    countries: ['PT'],
                    requiredBy: ['BRIDGE'],
                },
            ],
        },
    ],
}
it('shows both required documents in Peanut and submits metadata choices only', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined)
    renderWithIntl(
        <KycDocumentSelectionModal
            plan={plan}
            busy={false}
            error={null}
            onClose={jest.fn()}
            onFeatures={jest.fn()}
            onConfirm={onConfirm}
        />
    )
    expect(screen.getByText('Proof of address')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to verification' })).toBeDisabled()
    fireEvent.change(screen.getAllByLabelText('Document type')[0], { target: { value: 'RESIDENCE_PERMIT' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to verification' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Continue to verification' }))
    expect(onConfirm).toHaveBeenCalledWith('identity-and-poa', [
        { key: 'identity', type: 'RESIDENCE_PERMIT', issuingCountry: 'PT' },
        { key: 'address-proof', type: 'BANK_STATEMENT', issuingCountry: 'PT' },
    ])
    expect(screen.queryByRole('textbox')).toBeNull()
})
