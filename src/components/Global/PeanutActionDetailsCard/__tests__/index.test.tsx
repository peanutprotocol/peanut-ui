/**
 * PeanutActionDetailsCard — title copy.
 *
 * REGRESSION GUARD. This card's WITHDRAW title has been flipped in opposite
 * directions twice by two different engineers:
 *
 *   abd71b882 (2026-03-20) "you're withdrawing" -> "you're sending"
 *   d532b6a65 (2026-07-13) "You're sending"     -> "You're withdrawing"
 *
 * Both were right about the flow in front of them: Send -> Exchange or Wallet /
 * Bank navigates into the withdraw routes, so this one card serves two user
 * intents. With a single transactionType it can only ever be correct for one of
 * them, and the word gets flipped again. `isFromSendFlow` is that missing
 * discriminator — if you are here because the copy "looks wrong", fix the caller
 * that fails to pass it, not the word.
 */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import PeanutActionDetailsCard from '../index'

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        const { priority, layout, objectFit, fill, ...rest } = props
        return <img {...rest} />
    },
}))

const baseProps = {
    recipientType: 'USERNAME' as const,
    recipientName: '',
    amount: '50.00',
    tokenSymbol: 'USDC',
}

describe('PeanutActionDetailsCard — withdraw vs send framing', () => {
    describe.each(['WITHDRAW', 'WITHDRAW_BANK_ACCOUNT'] as const)('%s', (transactionType) => {
        it('reads as a withdrawal by default', () => {
            renderWithIntl(<PeanutActionDetailsCard {...baseProps} transactionType={transactionType} />)

            expect(screen.getByText(/You're withdrawing/i)).toBeInTheDocument()
            expect(screen.queryByText(/You're sending/i)).not.toBeInTheDocument()
        })

        it('reads as a send when reached through the send flow', () => {
            renderWithIntl(<PeanutActionDetailsCard {...baseProps} transactionType={transactionType} isFromSendFlow />)

            expect(screen.getByText(/You're sending/i)).toBeInTheDocument()
            expect(screen.queryByText(/You're withdrawing/i)).not.toBeInTheDocument()
        })
    })

    it('leaves non-withdraw transaction types alone', () => {
        // ADD_MONEY has no send framing — the flag must not leak across the map.
        renderWithIntl(<PeanutActionDetailsCard {...baseProps} transactionType="ADD_MONEY" isFromSendFlow />)

        expect(screen.getByText(/You're adding/i)).toBeInTheDocument()
    })
})

// TASK-22625: the avatar slot that used to draw initials shows the sender's or
// recipient's pick. Every slot that already carried an icon keeps it.
describe('PeanutActionDetailsCard — counterparty avatar', () => {
    it('renders the picked avatar for a Peanut handle', () => {
        const { container } = renderWithIntl(
            <PeanutActionDetailsCard
                {...baseProps}
                recipientName="satoshi"
                transactionType="CLAIM_LINK"
                avatarKey="basic.frog"
            />
        )

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/frog.webp')
    })

    it('falls back to the handle letter without a pick', () => {
        const { container } = renderWithIntl(
            <PeanutActionDetailsCard
                {...baseProps}
                recipientName="satoshi"
                transactionType="CLAIM_LINK"
                avatarKey={null}
            />
        )

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/letter/s.webp')
    })

    it('keeps the wallet icon for an address recipient', () => {
        const { container } = renderWithIntl(
            <PeanutActionDetailsCard
                {...baseProps}
                recipientType="ADDRESS"
                recipientName="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
                transactionType="REQUEST_PAYMENT"
                avatarKey="basic.frog"
            />
        )

        expect(container.querySelector('img')).toBeNull()
        expect(container.querySelector('svg')).not.toBeNull()
    })

    it('keeps the success check instead of an avatar', () => {
        const { container } = renderWithIntl(
            <PeanutActionDetailsCard
                {...baseProps}
                recipientName="satoshi"
                transactionType="CLAIM_LINK"
                viewType="SUCCESS"
                avatarKey="basic.frog"
            />
        )

        expect(container.querySelector('img')).toBeNull()
        expect(container.querySelector('svg')).not.toBeNull()
    })
})

// The claim views and CountryListRouter hardcode recipientType="USERNAME" and
// pass a resolved display name, which is a shortened address for a sender with
// no Peanut account. Those rows have no person to show.
describe('PeanutActionDetailsCard — a hardcoded USERNAME with an address name', () => {
    it('keeps the initials bubble for a shortened address', () => {
        const { container } = renderWithIntl(
            <PeanutActionDetailsCard
                {...baseProps}
                recipientType="USERNAME"
                recipientName="0xf39F…2266"
                transactionType="CLAIM_LINK"
            />
        )

        expect(container.querySelector('img')).toBeNull()
        expect(container).toHaveTextContent('0X')
    })
})
