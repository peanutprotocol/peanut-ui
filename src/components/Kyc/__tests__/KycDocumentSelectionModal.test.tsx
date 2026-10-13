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
            id: 'identity',
            documents: [
                {
                    key: 'identity',
                    code: 'IDENTITY',
                    types: ['PASSPORT', 'RESIDENCE_PERMIT'],
                    countries: ['PT'],
                    requiredBy: ['SUMSUB'],
                },
            ],
        },
    ],
}
// An API from before the proof of address moved after the identity still lists one beside it.
const olderPlan = {
    ...plan,
    routes: [
        {
            id: 'identity-and-poa',
            documents: [
                ...plan.routes[0].documents,
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
} as unknown as KycDocumentPlan

it('asks for the identity document only and submits metadata choices only', async () => {
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
    expect(screen.getByText('Identity document')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to verification' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'RESIDENCE_PERMIT' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to verification' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Continue to verification' }))
    expect(onConfirm).toHaveBeenCalledWith('identity', [
        { key: 'identity', type: 'RESIDENCE_PERMIT', issuingCountry: 'PT' },
    ])
    expect(screen.queryByRole('textbox')).toBeNull()
})

it('never offers or sends a proof of address, even from an older API plan', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined)
    renderWithIntl(
        <KycDocumentSelectionModal
            plan={olderPlan}
            busy={false}
            error={null}
            onClose={jest.fn()}
            onFeatures={jest.fn()}
            onConfirm={onConfirm}
        />
    )
    expect(screen.queryByText('Proof of address')).toBeNull()
    expect(screen.getAllByLabelText('Document type')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'PASSPORT' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to verification' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Continue to verification' }))
    expect(onConfirm).toHaveBeenCalledWith('identity-and-poa', [
        { key: 'identity', type: 'PASSPORT', issuingCountry: 'PT' },
    ])
})

it('marks the controls a browser test drives', () => {
    renderWithIntl(
        <KycDocumentSelectionModal
            plan={{ ...plan, routes: [...plan.routes, { ...plan.routes[0], id: 'second' }] }}
            busy={false}
            error={null}
            onClose={jest.fn()}
            onFeatures={jest.fn()}
            onConfirm={jest.fn()}
        />
    )
    for (const feature of ['qr', 'local', 'bank', 'card'])
        expect(screen.getByTestId(`kyc-documents-feature-${feature}`)).toHaveAttribute('type', 'checkbox')
    expect(screen.getByTestId('kyc-documents-route').tagName).toBe('SELECT')
    expect(screen.getByTestId('kyc-documents-type')).toBe(screen.getByLabelText('Document type'))
    expect(screen.getByTestId('kyc-documents-country')).toBe(screen.getByLabelText('Issuing country'))
    expect(screen.getByTestId('kyc-documents-continue')).toBe(
        screen.getByRole('button', { name: 'Continue to verification' })
    )
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

describe('document labels', () => {
    const props = { busy: false, error: null, onClose: jest.fn(), onFeatures: jest.fn(), onConfirm: jest.fn() }
    const identity = (countries: string[]) => ({
        key: 'identity',
        code: 'IDENTITY' as const,
        types: ['PASSPORT'],
        countries,
        requiredBy: ['SUMSUB' as const],
    })

    it('names the bank feature by the account currencies it opens', () => {
        renderWithIntl(<KycDocumentSelectionModal plan={plan} {...props} />)
        expect(screen.getByRole('checkbox', { name: 'USD, EUR, MXN and GBP accounts' })).toBeChecked()
    })

    it('tells routes with the same documents apart by issuing country', () => {
        renderWithIntl(
            <KycDocumentSelectionModal
                plan={{
                    ...plan,
                    routes: [
                        { id: 'eu', documents: [identity(['ES', 'DE'])] },
                        { id: 'pt', documents: [identity(['PT'])] },
                    ],
                }}
                {...props}
            />
        )
        const options = screen.getAllByRole('option').map((o) => o.textContent)
        expect(options).toEqual(
            expect.arrayContaining([
                'Identity document — Passport (Germany, Spain)',
                'Identity document — Passport (Portugal)',
            ])
        )
    })

    it('lists issuing countries by their localized name, not manifest order', () => {
        renderWithIntl(
            <KycDocumentSelectionModal
                plan={{ ...plan, routes: [{ id: 'one', documents: [identity(['GB', 'CH', 'DE'])] }] }}
                {...props}
            />
        )
        const country = screen.getByLabelText('Issuing country')
        const names = Array.from(country.querySelectorAll('option'))
            .slice(1)
            .map((o) => o.textContent)
        expect(names).toEqual(['Germany', 'Switzerland', 'United Kingdom'])
    })
})

it('a feature the verified document cannot open offers the same new identity check as the setup status', () => {
    const onVerifyAgain = jest.fn()
    const error = 'USD, EUR, MXN and GBP accounts: this needs a different ID document than the one you verified with.'
    renderWithIntl(
        <KycDocumentSelectionModal
            plan={plan}
            preferencesOnly
            busy={false}
            error={error}
            onClose={jest.fn()}
            onFeatures={jest.fn()}
            onConfirm={jest.fn()}
            onVerifyAgain={onVerifyAgain}
        />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(error)
    expect(screen.queryByText(/support/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Verify with a different document' }))
    expect(onVerifyAgain).toHaveBeenCalledTimes(1)
})

it('offers no new identity check for any other error', () => {
    renderWithIntl(
        <KycDocumentSelectionModal
            plan={plan}
            preferencesOnly
            busy={false}
            error="Something went wrong."
            onClose={jest.fn()}
            onFeatures={jest.fn()}
            onConfirm={jest.fn()}
        />
    )
    expect(screen.queryByRole('button', { name: 'Verify with a different document' })).toBeNull()
})
