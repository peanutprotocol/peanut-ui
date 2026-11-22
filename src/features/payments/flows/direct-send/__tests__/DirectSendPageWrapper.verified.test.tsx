import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { AccountType } from '@/interfaces/interfaces'
import type { DirectSendRecipient } from '../DirectSendFlowContext'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
let mockProfile: Record<string, unknown> | null = null
jest.mock('@/lib/person/usePerson', () => ({
    usePerson: () => ({ profile: mockProfile, isLoading: false, error: null }),
}))
jest.mock('../DirectSendPage', () => ({
    DirectSendPage: ({ recipient }: { recipient: DirectSendRecipient }) => (
        <span data-testid="verified">{String(recipient.isVerified)}</span>
    ),
}))

import { DirectSendPageWrapper } from '../DirectSendPageWrapper'

// TASK-21376: the Send screen ticked every Peanut user (!!userId) while the
// contacts list showed the profile's verified flag
it.each([false, true])('carries the profile verified flag (%s) to the Send screen', (isVerified) => {
    mockProfile = {
        username: 'ana',
        userId: 'u1',
        fullName: 'Ana Example',
        isVerified,
        accounts: [{ type: AccountType.PEANUT_WALLET, identifier: '0x1111111111111111111111111111111111111111' }],
    }
    render(<DirectSendPageWrapper username="ana" />, { wrapper: IntlWrapper })
    expect(screen.getByTestId('verified')).toHaveTextContent(String(isVerified))
})
