import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { useUserByUsername } from '@/hooks/useUserByUsername'
import { AccountType } from '@/interfaces/interfaces'
import { DirectSendPageWrapper } from '../DirectSendPageWrapper'

jest.mock('@/hooks/useUserByUsername', () => ({ useUserByUsername: jest.fn() }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('../DirectSendPage', () => ({
    DirectSendPage: ({ recipient }: { recipient: { userId?: string; isVerified?: boolean } }) => (
        <div data-testid="recipient-verification">{`${recipient.userId}:${recipient.isVerified}`}</div>
    ),
}))

const mockLookup = useUserByUsername as jest.MockedFunction<typeof useUserByUsername>

it('does not treat a found user ID as identity verification', () => {
    mockLookup.mockReturnValue({
        user: {
            userId: 'recipient-1',
            username: 'satoshi',
            accounts: [{ type: AccountType.PEANUT_WALLET, identifier: '0x0000000000000000000000000000000000000001' }],
            fullName: 'Satoshi',
            firstName: 'Satoshi',
            lastName: '',
            totalUsdSentToCurrentUser: '0',
            totalUsdReceivedFromCurrentUser: '0',
            isVerified: false,
        },
        isLoading: false,
        error: null,
    })

    renderWithIntl(<DirectSendPageWrapper username="satoshi" />)
    expect(screen.getByTestId('recipient-verification')).toHaveTextContent('recipient-1:false')
})
