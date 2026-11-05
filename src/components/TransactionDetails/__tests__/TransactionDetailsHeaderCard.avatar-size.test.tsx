import React from 'react'
import { render } from '@testing-library/react'
import { personFrom } from '@/lib/person/person'
import { firstSquareBoxPx } from '@/test-utils/avatar-box'
import { IntlWrapper } from '@/test-utils/intl'
import { TransactionDetailsHeaderCard } from '../TransactionDetailsHeaderCard'

// The real TransactionAvatarBadge renders here (the main header suite mocks
// it): this suite checks the size the slot really draws.
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: React.ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))
jest.mock('@/components/Avatar/useAvatarArt', () => ({ useAvatarArt: () => ({}) }))
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ invitedUsernamesSet: new Set(), user: null }) }))

type HeaderProps = Partial<React.ComponentProps<typeof TransactionDetailsHeaderCard>>

const renderHeader = (props: HeaderProps) =>
    render(
        <TransactionDetailsHeaderCard
            direction="send"
            userName="natalia"
            amountDisplay="$25.00"
            initials="N"
            status="completed"
            {...props}
        />,
        { wrapper: IntlWrapper }
    )

// TASK-24388: the payment details header shows the counterparty at 96 px,
// and whatever stands in their place takes the same 96 px slot.
describe('TransactionDetailsHeaderCard avatar slot is 96 px', () => {
    const cases: Array<[string, HeaderProps]> = [
        ['a person (their sticker)', { person: personFrom({ username: 'natalia', avatarKey: 'basic.frog' }) }],
        ['a person with no pick (letter sticker)', { person: personFrom({ username: 'natalia', avatarKey: null }) }],
        [
            'a bank flag',
            { direction: 'bank_withdraw', transactionType: 'bank_withdraw', countryCode: 'ar', userName: 'AR bank' },
        ],
        ['a bank without a flag', { direction: 'bank_withdraw', transactionType: 'bank_withdraw', userName: 'Bank' }],
        ['a link (state bubble)', { isLinkTransaction: true, status: 'pending' }],
        ['a card spend (card bubble)', { direction: 'qr_payment', transactionType: 'card_pay', userName: 'Shop' }],
        ['an avatar image', { avatarUrl: 'https://example.org/a.png' }],
        [
            'a merchant logo',
            {
                direction: 'qr_payment',
                transactionType: 'card_pay',
                userName: 'Shop',
                merchantLogo: 'https://example.org/m.png',
            },
        ],
        // the setup-confirmation transaction (isTestTransaction) shows the Peanut logo
        ['the test transaction logo', { userName: 'Enjoy Peanut!' }],
    ]

    test.each(cases)('%s', (_label, props) => {
        const { container } = renderHeader(props)
        expect(firstSquareBoxPx(container)).toBe(96)
    })
})
