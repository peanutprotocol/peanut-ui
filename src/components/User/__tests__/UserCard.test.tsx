/**
 * UserCard avatar (TASK-22625). The identity card at the top of every send,
 * request and pot flow shows who the money is going to — so it shows the
 * avatar that person picked, and keeps the wallet bubble for a bare address.
 */
import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import UserCard from '../UserCard'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
// The address branch renders AddressLink, whose ENS lookup needs a query client.
jest.mock('@/hooks/usePrimaryNameServer', () => ({ usePrimaryNameServer: () => ({ primaryName: undefined }) }))
jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: ({ name }: { name: string }) => <span>{name}</span>,
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: React.ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

describe('UserCard avatar', () => {
    it('aligns the recipient name with the caption and places the send arrow after it', () => {
        renderWithIntl(<UserCard type="send" username="satoshi" recipientType="USERNAME" />)

        const caption = screen.getByText("You're sending money to")
        expect(caption.nextElementSibling?.tagName.toLowerCase()).toBe('svg')
        expect(caption.parentElement?.nextElementSibling).toHaveTextContent('satoshi')
    })

    it('renders the recipient picked avatar', () => {
        const { container } = renderWithIntl(
            <UserCard type="send" username="satoshi" recipientType="USERNAME" avatarKey="basic.frog" />
        )

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/frog.webp')
    })

    // The card shows the full name in its label; the sticker follows the handle
    // so the same person looks the same in the flow and on their profile.
    it('falls back to the username letter, not the full-name initials', () => {
        const { container } = renderWithIntl(
            <UserCard
                type="send"
                username="satoshi"
                fullName="Satoshi Nakamoto"
                recipientType="USERNAME"
                avatarKey={null}
            />
        )

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/letter/s.webp')
        expect(screen.queryByText('SN')).not.toBeInTheDocument()
    })

    it('keeps the wallet bubble for an address recipient', () => {
        const { container } = renderWithIntl(
            <UserCard type="send" username="0xf39F…2266" recipientType="ADDRESS" avatarKey="basic.frog" />
        )

        expect(container.querySelector('img')).toBeNull()
        expect(container.querySelector('svg')).not.toBeNull()
    })

    it('leaves the avatar out of the accessibility tree — the card names the person', () => {
        renderWithIntl(<UserCard type="send" username="satoshi" recipientType="USERNAME" avatarKey="basic.frog" />)

        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
})
