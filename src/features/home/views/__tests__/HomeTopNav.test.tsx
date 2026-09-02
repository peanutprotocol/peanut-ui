import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { HomeTopNav } from '../HomeTopNav'

jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Home/InvitesIcon', () => ({ __esModule: true, default: () => null }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

describe('HomeTopNav', () => {
    it('wears the picked avatar inside the profile link', () => {
        const { container } = renderWithIntl(
            <HomeTopNav username="testuser" avatarKey="basic.frog" showRewards={false} />
        )

        expect(container.querySelector('a[href="/profile"] img')).toHaveAttribute('src', '/avatars/basic/frog.svg')
    })

    it('falls back to one username initial, not the name initials', () => {
        const { container } = renderWithIntl(<HomeTopNav username="testuser" avatarKey={null} showRewards={false} />)

        expect(container.querySelector('a[href="/profile"]')).toHaveTextContent(/^T$/)
        expect(screen.queryByText(/^TE$/i)).not.toBeInTheDocument()
    })

    it('still links to the profile when there is no username yet', () => {
        const { container } = renderWithIntl(<HomeTopNav showRewards={false} />)

        expect(container.querySelector('a[href="/profile"]')).toBeInTheDocument()
    })
})
