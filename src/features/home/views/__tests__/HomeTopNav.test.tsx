import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { HomeTopNav } from '../HomeTopNav'

jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Home/InvitesIcon', () => ({ __esModule: true, default: () => null }))

describe('HomeTopNav', () => {
    it('wears the generated face, not initials — this chip is the user own identity', () => {
        const { container } = renderWithIntl(<HomeTopNav avatarName="testuser" showRewards={false} />)

        // DotFaceAvatar draws an svg; the initials avatar would render the letters
        expect(container.querySelector('a[href="/profile"] svg')).toBeInTheDocument()
        expect(screen.queryByText(/^TE$/i)).not.toBeInTheDocument()
    })

    it('falls back to the no-name circle when there is no username yet', () => {
        const { container } = renderWithIntl(<HomeTopNav showRewards={false} />)

        expect(container.querySelector('a[href="/profile"]')).toBeInTheDocument()
    })
})
