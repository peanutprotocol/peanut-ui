/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { CapabilityRoute, NextAction } from '@/types/capabilities'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
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

import { AveniaPixSetup } from '../components/AveniaPixSetup'

const TERMS_URL = 'https://app.avenia.io/Avenia-TC.pdf'
const route = (overrides: Partial<CapabilityRoute>): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'action_required',
    candidates: [],
    ...overrides,
})
const renderSetup = (r: CapabilityRoute) =>
    renderWithIntl(<AveniaPixSetup title="Add money" onBack={jest.fn()} route={r} />)

describe('AveniaPixSetup', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockNextActions = [
            { key: 'accept-tos:avenia', kind: 'accept-tos', purpose: 'unlock-avenia', tosUrl: TERMS_URL },
        ]
    })

    it("names and links Avenia's terms, the document the API versions, before the tap that accepts them", () => {
        renderSetup(route({ action: 'accept-tos:avenia', reason: { code: 'terms_required', userMessage: '' } }))

        expect(screen.getByRole('link')).toHaveAttribute('href', TERMS_URL)
        expect(mockTermsHook).toHaveBeenCalledWith('accept-tos:avenia')
        fireEvent.click(screen.getByRole('button', { name: en.common.continue }))
        expect(mockAccept).toHaveBeenCalled()
    })

    it.each([
        ['provider_reviewing', en.avenia.setup.reviewing],
        ['avenia_import_unavailable', en.avenia.setup.importUnavailable],
    ])('waits with the reason as user text (%s)', (code, text) => {
        renderSetup(route({ state: 'pending', reason: { code, userMessage: '' } }))
        expect(screen.getByText(text)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.common.continue })).toBeNull()
    })

    it('sends a missing CPF to support', () => {
        renderSetup(route({ state: 'pending', reason: { code: 'avenia_cpf_missing', userMessage: '' } }))
        expect(screen.getByText(en.avenia.setup.cpfRequired)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.common.contactSupport }))
        expect(mockOpenSupport).toHaveBeenCalled()
    })

    it('sends a user whose identity is not verified to the identity check first', () => {
        renderSetup(route({ action: 'verify' }))
        fireEvent.click(screen.getByRole('button', { name: en.avenia.setup.verifyCta }))
        expect(mockPush).toHaveBeenCalledWith('/verify')
        expect(mockTermsHook).toHaveBeenCalledWith(undefined)
    })
})
