/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { CapabilityRoute } from '@/types/capabilities'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
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
    beforeEach(() => jest.clearAllMocks())

    it("explains the partner rejection in the user's language and offers support", () => {
        renderWithIntl(<PixUnavailableScreen title="Withdraw" route={refused('provider_rejected', 'Rejected.')} />)
        expect(screen.getByText(en.pix.rejected)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.common.contactSupport }))
        expect(mockOpenSupport).toHaveBeenCalledWith(expect.stringContaining('provider_rejected'))
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
    ])('gives %s its own line', (code, line) => {
        renderWithIntl(<PixUnavailableScreen title="Withdraw" route={refused(code, 'From the API.')} />)
        expect(screen.getByText(line)).toBeInTheDocument()
        if (code !== 'provider_unavailable') {
            expect(screen.queryByText(/try again/i)).toBeNull()
        }
    })
})
