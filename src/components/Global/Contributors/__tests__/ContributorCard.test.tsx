/**
 * Pot contributor avatars (TASK-22625). A Peanut contributor shows the avatar
 * they picked; an anonymous on-chain contributor keeps the wallet bubble,
 * because there is no person behind that row to show.
 */
import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import ContributorCard, { type Contributor } from '../ContributorCard'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: ({ name }: { name: string }) => <span>{name}</span>,
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: React.ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

const contributor = (overrides: Partial<Contributor>): Contributor => ({
    uuid: 'charge-1',
    payments: [],
    amount: '10',
    username: 'satoshi',
    fulfillmentPayment: null,
    isUserVerified: false,
    isPeanutUser: true,
    ...overrides,
})

describe('ContributorCard avatar', () => {
    it('renders the picked avatar of a Peanut contributor', () => {
        const { container } = renderWithIntl(
            <ContributorCard contributor={contributor({ avatarKey: 'basic.frog' })} position="solo" />
        )

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/frog.webp')
    })

    it('falls back to the username letter without a pick', () => {
        const { container } = renderWithIntl(
            <ContributorCard contributor={contributor({ avatarKey: null })} position="solo" />
        )

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/letter/s.webp')
    })

    it('keeps the wallet bubble for an anonymous on-chain contributor', () => {
        const { container } = renderWithIntl(
            <ContributorCard
                contributor={contributor({
                    username: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                    isPeanutUser: false,
                    avatarKey: null,
                })}
                position="solo"
            />
        )

        expect(container.querySelector('img')).toBeNull()
        expect(container.querySelector('svg')).not.toBeNull()
    })

    it('leaves the avatar out of the accessibility tree — the row names the contributor', () => {
        renderWithIntl(<ContributorCard contributor={contributor({ avatarKey: 'basic.frog' })} position="solo" />)

        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
})
