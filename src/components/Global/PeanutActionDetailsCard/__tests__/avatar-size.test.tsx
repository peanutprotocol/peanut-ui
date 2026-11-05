import React from 'react'
import { personFrom } from '@/lib/person/person'
import { firstSquareBoxPx } from '@/test-utils/avatar-box'
import { renderWithIntl } from '@/test-utils/intl'
import UserCard from '@/components/User/UserCard'
import PeanutActionDetailsCard from '../index'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: React.ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))
jest.mock('@/components/Avatar/useAvatarArt', () => ({ useAvatarArt: () => ({}) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: ({ name }: { name: string }) => <span>{name}</span>,
}))

// TASK-24388: every confirm card shows its counterparty at 32 px, whatever
// stands in the slot, so the cards in one flow line up.
const card = { amount: '50.00', tokenSymbol: 'USDC' }
const satoshi = personFrom({ username: 'satoshi', avatarKey: 'basic.frog' })

describe('PeanutActionDetailsCard avatar slot is 32 px', () => {
    const cases: Array<[string, React.ComponentProps<typeof PeanutActionDetailsCard>]> = [
        [
            'a person (their sticker)',
            {
                ...card,
                transactionType: 'CLAIM_LINK',
                recipientType: 'USERNAME',
                recipientName: 'satoshi',
                person: satoshi,
            },
        ],
        [
            'an address (crypto icon)',
            { ...card, transactionType: 'REQUEST_PAYMENT', recipientType: 'ADDRESS', recipientName: '0xabc' },
        ],
        [
            'a bank with a flag',
            {
                ...card,
                transactionType: 'WITHDRAW_BANK_ACCOUNT',
                recipientType: 'BANK_ACCOUNT',
                recipientName: 'AR',
                countryCodeForFlag: 'ar',
            },
        ],
        [
            'a bank without a flag (bank bubble)',
            { ...card, transactionType: 'WITHDRAW_BANK_ACCOUNT', recipientType: 'BANK_ACCOUNT', recipientName: 'AR' },
        ],
    ]

    test.each(cases)('%s', (_label, props) => {
        const { container } = renderWithIntl(<PeanutActionDetailsCard {...props} />)
        expect(firstSquareBoxPx(container)).toBe(32)
    })
})

describe('UserCard avatar slot is 32 px', () => {
    it('for a Peanut user (their sticker)', () => {
        const { container } = renderWithIntl(
            <UserCard type="send" username="satoshi" recipientType="USERNAME" person={satoshi} />
        )
        expect(firstSquareBoxPx(container)).toBe(32)
    })

    it('for an address (crypto icon)', () => {
        const { container } = renderWithIntl(
            <UserCard type="send" username="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" recipientType="ADDRESS" />
        )
        expect(firstSquareBoxPx(container)).toBe(32)
    })
})
