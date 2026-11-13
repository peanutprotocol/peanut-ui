/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { CapabilityRoute } from '@/types/capabilities'

let mockRoutes: CapabilityRoute[] = []
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ capabilities: { routes: mockRoutes } }) }))
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ identity: null }) }))
const mockOpenSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: mockOpenSupport }),
    useModalsContextOptional: () => null,
}))

import { ClosedRowDrawer } from '../ClosedRowDrawer'

const refused = (code: string, userMessage: string): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: null,
    state: 'refused',
    reason: { code, userMessage },
    candidates: [],
})
const open = () =>
    renderWithIntl(<ClosedRowDrawer closed={{ kind: 'pix-route' }} onClose={jest.fn()} onChangeResidence={jest.fn()} />)

// Aleks on staging (the Pix provider unconfigured): the BRL row's drawer said "Bank transfers aren't available for
// residents of your country." A refused Pix route says its own reason, as the Pix pages do; never a residence rule it is not
describe('ClosedRowDrawer for a BRL row its Pix route refuses', () => {
    beforeEach(() => jest.clearAllMocks())

    it.each([
        ['provider_unavailable', 'Pix is down.', en.pix.unavailable],
        // the launch gate: a resident outside the allowlist reads "not for your account yet"
        ['rollout_closed', 'This is not available for your account yet.', en.pix.rolloutClosed],
        // our own final identity refusal has no line of its own here: the route's own message
        ['identity_rejected', 'We could not verify your identity.', 'We could not verify your identity.'],
        // a residence refusal is the one that names the residence
        ['residence_not_served', 'Not where you live.', en.pix.residenceNotServed],
    ])('says the route reason (%s), not the residence rule for bank transfers', (code, message, line) => {
        mockRoutes = [refused(code, message)]
        open()
        expect(screen.getByText(line)).toBeInTheDocument()
        expect(screen.queryByText(en.profile.unlockPayments.bankOnlyNotAvailableNote)).toBeNull()
        expect(screen.getByRole('button', { name: en.common.gotIt })).toBeInTheDocument()
    })

    it('offers support, with the reason, where only support can lift the refusal', () => {
        jest.useFakeTimers()
        try {
            mockRoutes = [refused('provider_rejected', 'Rejected.')]
            open()
            expect(screen.getByText(en.pix.rejected)).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: en.common.contactSupport }))
            // the support sheet opens once this one has slid out
            jest.runAllTimers()
            expect(mockOpenSupport.mock.calls[0][0]).toContain('reason: provider_rejected')
        } finally {
            jest.useRealTimers()
        }
    })
})
