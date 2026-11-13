/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { CapabilityRoute, NextAction } from '@/types/capabilities'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1' } }, fetchUser: mockFetchUser }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isVerified: true }) }))
jest.mock('@/hooks/useHostedVerification', () => ({ useHostedVerification: jest.fn() }))
const mockOpenSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: mockOpenSupport }),
    useModalsContextOptional: () => null,
}))
let mockNextActions: NextAction[] = []
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ nextActions: mockNextActions }) }))
const mockAccept = jest.fn()
const mockTermsHook = jest.fn((key: string | undefined) => ({
    accept: mockAccept,
    isAccepting: false,
    error: null,
    key,
}))
jest.mock('@/hooks/useRouteTermsAcceptance', () => ({
    useRouteTermsAcceptance: (key: string | undefined) => mockTermsHook(key),
}))
const mockGate = jest.fn()
jest.mock('@/features/paperwork-verification/KycFeatureActivationGate', () => ({
    KycFeatureActivationGate: (props: { feature: string; scope: unknown }) => {
        mockGate(props.feature, props.scope)
        return <div>activation gate</div>
    },
}))

const mockRailStep = jest.fn()
jest.mock('@/features/pix/components/PixRailStep', () => ({
    PixRailStep: (props: { route: CapabilityRoute; providerId: string | null }) => {
        mockRailStep(props.route, props.providerId)
        return <div>rail step</div>
    },
}))

import { PixSetup } from '../components/PixSetup'

const route = (overrides: Partial<CapabilityRoute>): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'manteca',
    state: 'action_required',
    candidates: [],
    ...overrides,
})
const renderSetup = (r: CapabilityRoute) => renderWithIntl(<PixSetup title="Add money" onBack={jest.fn()} route={r} />)

describe('PixSetup', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockNextActions = []
    })

    it('waits while the provider reviews, with the reason as user text', () => {
        renderSetup(route({ state: 'pending', reason: { code: 'provider_reviewing', userMessage: '' } }))
        expect(screen.getByText(en.pix.setup.reviewing)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.continue })).toBeNull()
    })

    it('sends a user whose identity is not verified to the identity check first', () => {
        renderSetup(route({ action: 'verify' }))
        fireEvent.click(screen.getByRole('button', { name: en.pix.setup.verifyCta }))
        expect(mockPush).toHaveBeenCalledWith('/verify')
        expect(mockTermsHook).toHaveBeenCalledWith(undefined)
    })

    // the first use opens the provider's account (route action `activate`): the activation gate opens it,
    // and the route turns ready once it is open
    it('opens the account the first use needs through the activation gate', () => {
        renderSetup(route({ action: 'activate' }))
        expect(screen.getByText('activation gate')).toBeInTheDocument()
        expect(mockGate).toHaveBeenCalledWith('local', { channel: 'bank', country: 'BR' })
        expect(mockTermsHook).toHaveBeenCalledWith(undefined)
    })

    // TASK-24910: Bridge's rail asks, on the Pix route, for the steps it asks on the bank rails
    it.each([
        { key: 'accept-tos', kind: 'accept-tos', purpose: 'accept-bridge-tos' },
        { key: 'sumsub:tax_identification_number', kind: 'sumsub', purpose: 'unlock-bridge' },
        { key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'bridge-additional-verification', currency: 'BRL' },
    ] as NextAction[])("hands a rail's $kind step to the bank rails' screens", (action) => {
        mockNextActions = [action]
        renderSetup(route({ provider: 'bridge', action: action.key }))
        expect(screen.getByText('rail step')).toBeInTheDocument()
        expect(mockRailStep).toHaveBeenCalledWith(expect.objectContaining({ action: action.key }), 'bridge')
        expect(mockTermsHook).toHaveBeenCalledWith(undefined)
    })

    it('sends a terms step whose provider this build has no record of to support, never an unnamed consent', () => {
        mockNextActions = [
            {
                key: 'accept-tos:newpix',
                kind: 'accept-tos',
                purpose: 'unlock-newpix',
                tosUrl: 'https://example.com/terms',
            },
        ]
        renderSetup(
            route({
                // a code no registry entry answers for
                provider: 'newpix' as CapabilityRoute['provider'],
                action: 'accept-tos:newpix',
                reason: { code: 'terms_required', userMessage: '' },
            })
        )
        expect(screen.queryByRole('link')).toBeNull()
        expect(screen.getByText(en.pix.setup.notAvailable)).toBeInTheDocument()
    })
})
