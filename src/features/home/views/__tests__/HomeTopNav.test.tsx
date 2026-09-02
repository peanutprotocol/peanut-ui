import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { HomeTopNav } from '../HomeTopNav'

jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Home/InvitesIcon', () => ({ __esModule: true, default: () => null }))

describe('HomeTopNav', () => {
    it('wears the ds initials avatar — the dot-face experiment is reverted', () => {
        const { container } = renderWithIntl(<HomeTopNav avatarName="testuser" showRewards={false} />)

        // AvatarWithBadge renders the initials; the dot face drew an svg
        expect(screen.getByText(/^TE$/i)).toBeInTheDocument()
        expect(container.querySelector('a[href="/profile"] svg')).not.toBeInTheDocument()
    })

    it('falls back to the no-name circle when there is no username yet', () => {
        const { container } = renderWithIntl(<HomeTopNav showRewards={false} />)

        expect(container.querySelector('a[href="/profile"]')).toBeInTheDocument()
    })
})
