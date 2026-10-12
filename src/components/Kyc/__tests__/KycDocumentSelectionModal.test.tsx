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

it('updates verified users’ feature preferences without asking for documents again', () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined)
    renderWithIntl(
        <KycDocumentSelectionModal
            preferencesOnly
            plan={{ ...plan, available: false, routes: [] }}
            busy={false}
            error={null}
            onClose={jest.fn()}
            onFeatures={jest.fn()}
            onConfirm={onConfirm}
        />
    )
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(
        screen.getByText('Choose the payment features you’d like to use. Your identity stays verified.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onConfirm).toHaveBeenCalledWith('', [], plan.features)
})

it('a verified user’s ticks are sent only on Continue, because saving them enrols providers', () => {
    const onFeatures = jest.fn()
    const onConfirm = jest.fn().mockResolvedValue(undefined)
    renderWithIntl(
        <KycDocumentSelectionModal
            preferencesOnly
            plan={{ ...plan, available: false, routes: [] }}
            busy={false}
            error={null}
            onClose={jest.fn()}
            onFeatures={onFeatures}
            onConfirm={onConfirm}
        />
    )
    const [, local, , card] = screen.getAllByRole('checkbox')
    fireEvent.click(card)
    fireEvent.click(local)
    fireEvent.click(local)
    expect(onFeatures).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onConfirm).toHaveBeenCalledWith('', [], { ...plan.features, card: true })
})

describe('choosing documents while features re-plan', () => {
    const route = (id: string, types: string[], countries: string[]) => ({
        id,
        documents: [{ key: 'identity', code: 'IDENTITY' as const, types, countries, requiredBy: ['SUMSUB' as const] }],
    })
    const twoRoutes: KycDocumentPlan = {
        ...plan,
        routes: [route('passport', ['PASSPORT'], ['PT']), route('ids', ['ID_CARD', 'DRIVERS'], ['PT', 'ES'])],
    }
    const props = { error: null, onClose: jest.fn(), onConfirm: jest.fn() }
    const [routeSelect, typeSelect, countrySelect] = [0, 1, 2]
    const combo = (index: number) => screen.getAllByRole('combobox')[index] as HTMLSelectElement

    it('keeps the chosen route and documents when a feature toggle returns a new plan', () => {
        const { rerender } = renderWithIntl(
            <KycDocumentSelectionModal plan={twoRoutes} busy={false} onFeatures={jest.fn()} {...props} />
        )
        fireEvent.change(combo(routeSelect), { target: { value: 'ids' } })
        fireEvent.change(combo(typeSelect), { target: { value: 'DRIVERS' } })
        fireEvent.change(combo(countrySelect), { target: { value: 'ES' } })

        const replanned = {
            ...twoRoutes,
            features: { ...twoRoutes.features, card: true },
            routes: [...twoRoutes.routes],
        }
        rerender(<KycDocumentSelectionModal plan={replanned} busy onFeatures={jest.fn()} {...props} />)
        rerender(
            <KycDocumentSelectionModal
                plan={{ ...replanned, routes: replanned.routes.map((r) => ({ ...r })) }}
                busy={false}
                onFeatures={jest.fn()}
                {...props}
            />
        )
        expect(combo(routeSelect).value).toBe('ids')
        expect(combo(typeSelect).value).toBe('DRIVERS')
        expect(combo(countrySelect).value).toBe('ES')
    })

    it('drops only the choices the new plan no longer allows', () => {
        const { rerender } = renderWithIntl(
            <KycDocumentSelectionModal plan={twoRoutes} busy={false} onFeatures={jest.fn()} {...props} />
        )
        fireEvent.change(combo(routeSelect), { target: { value: 'ids' } })
        fireEvent.change(combo(typeSelect), { target: { value: 'DRIVERS' } })
        fireEvent.change(combo(countrySelect), { target: { value: 'ES' } })
        rerender(
            <KycDocumentSelectionModal
                plan={{
                    ...twoRoutes,
                    routes: [twoRoutes.routes[0], route('ids', ['ID_CARD', 'DRIVERS'], ['PT', 'AR'])],
                }}
                busy={false}
                onFeatures={jest.fn()}
                {...props}
            />
        )
        expect(combo(typeSelect).value).toBe('DRIVERS')
        expect(combo(countrySelect).value).toBe('')
    })

    it('falls back to the first route when the chosen one leaves the plan', () => {
        const { rerender } = renderWithIntl(
            <KycDocumentSelectionModal plan={twoRoutes} busy={false} onFeatures={jest.fn()} {...props} />
        )
        fireEvent.change(combo(routeSelect), { target: { value: 'ids' } })
        rerender(
            <KycDocumentSelectionModal
                plan={{ ...twoRoutes, routes: [twoRoutes.routes[0], route('other', ['PASSPORT'], ['ES'])] }}
                busy={false}
                onFeatures={jest.fn()}
                {...props}
            />
        )
        expect(combo(routeSelect).value).toBe('passport')
    })

    it('keeps feature checkboxes focusable while a re-plan is in flight, ignoring changes', () => {
        const onFeatures = jest.fn()
        renderWithIntl(<KycDocumentSelectionModal plan={twoRoutes} busy onFeatures={onFeatures} {...props} />)
        const checkboxes = screen.getAllByRole('checkbox')
        checkboxes.forEach((checkbox) => expect(checkbox).toBeEnabled())
        expect(screen.getByRole('group', { name: 'What would you like to use?' })).toHaveAttribute('aria-busy', 'true')
        fireEvent.click(checkboxes[3])
        expect(onFeatures).not.toHaveBeenCalled()
        expect(checkboxes[3]).not.toBeChecked()
    })
})
