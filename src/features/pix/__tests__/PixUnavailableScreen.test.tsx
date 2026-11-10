/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { CapabilityRoute } from '@/types/capabilities'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
let mockNextActions: unknown[] = []
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ nextActions: mockNextActions }) }))
const mockOpenSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: mockOpenSupport }),
    useModalsContextOptional: () => null,
}))

import { PixUnavailableScreen } from '../components/PixUnavailableScreen'

const refused = (code: string, userMessage: string): CapabilityRoute => ({
    operation: 'withdraw',
    method: 'PIX_BR',
    provider: null,
    state: 'refused',
    reason: { code, userMessage },
    candidates: [{ provider: 'manteca', state: 'refused' }],
})

describe('PixUnavailableScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockNextActions = []
    })

    // the provider's own identity check did not pass: support, told the case by the route's support step
    it('says the verification was not accepted, and names the support case to support', () => {
        mockNextActions = [{ key: 'contact-support:avenia', kind: 'contact-support', purpose: 'avenia-support' }]
        renderWithIntl(
            <PixUnavailableScreen
                title="Add money"
                route={{
                    ...refused('IDENTITY_REJECTED', 'Avenia could not verify the identity.'),
                    action: 'contact-support:avenia',
                }}
            />
        )
        expect(screen.getByText(en.pix.rejected)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.common.contactSupport }))
        const message = mockOpenSupport.mock.calls[0][0] as string
        expect(message).toContain('reason: IDENTITY_REJECTED')
        expect(message).toContain('purpose: avenia-support')
    })

    it("says the verification was not accepted, in the user's language", () => {
        renderWithIntl(<PixUnavailableScreen title="Withdraw" route={refused('provider_rejected', 'Rejected.')} />)
        expect(screen.getByText(en.pix.rejected)).toBeInTheDocument()
    })

    it("shows the route's own reason text for a reason this build does not know, and offers support", () => {
        renderWithIntl(
            <PixUnavailableScreen
                title="Withdraw"
                route={refused('manteca_us_nationality', 'Pix is not available with a US passport.')}
            />
        )
        expect(screen.getByText('Pix is not available with a US passport.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.common.contactSupport }))
        expect(mockOpenSupport).toHaveBeenCalledWith(
            expect.stringContaining('Pix is not available with a US passport.')
        )
    })

    it('says Pix is not offered when the API sent no route', () => {
        renderWithIntl(<PixUnavailableScreen title="Add money" route={undefined} />)
        expect(screen.getByText(en.pix.methodNotServed)).toBeInTheDocument()
    })

    // only an outage changes by waiting: residence, rollout and an unserved method never say "try again"
    it.each([
        ['residence_not_served', en.pix.residenceNotServed],
        ['rollout_closed', en.pix.rolloutClosed],
        ['method_not_served', en.pix.methodNotServed],
        ['provider_unavailable', en.pix.unavailable],
        ['provider_paused', en.pix.unavailable],
    ])('gives %s its own line', (code, line) => {
        renderWithIntl(<PixUnavailableScreen title="Withdraw" route={refused(code, 'From the API.')} />)
        expect(screen.getByText(line)).toBeInTheDocument()
        if (code !== 'provider_unavailable' && code !== 'provider_paused') {
            expect(screen.queryByText(/try again/i)).toBeNull()
        }
    })
})
