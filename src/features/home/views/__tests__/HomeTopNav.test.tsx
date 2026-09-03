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
    it('shows the first letter as sticker art — not two-letter initials, not a generated face', () => {
        const { container } = renderWithIntl(<HomeTopNav username="testuser" showRewards={false} />)

        expect(container.querySelector('a[href="/profile"] img')).toHaveAttribute('src', '/avatars/letter/t.webp')
        expect(screen.queryByText(/^TE$/i)).not.toBeInTheDocument()
        expect(container.querySelector('a[href="/profile"] svg')).not.toBeInTheDocument()
    })

    it('wears the picked avatar inside the profile link (TASK-22142)', () => {
        const { container } = renderWithIntl(
            <HomeTopNav username="testuser" avatarKey="basic.frog" showRewards={false} />
        )

        expect(container.querySelector('a[href="/profile"] img')).toHaveAttribute('src', '/avatars/basic/frog.webp')
        expect(container.querySelector('a[href="/profile"]')).not.toHaveTextContent('T')
    })

    it('falls back to the no-name circle when there is no username yet', () => {
        const { container } = renderWithIntl(<HomeTopNav showRewards={false} />)

        expect(container.querySelector('a[href="/profile"]')).toBeInTheDocument()
    })
})
