import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { HomeTopNav } from '../HomeTopNav'

jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Home/InvitesIcon', () => ({ __esModule: true, default: () => null }))

describe('HomeTopNav', () => {
    it('opens the profile through ONE labelled control', () => {
        const { container } = renderWithIntl(<HomeTopNav showRewards={false} />)

        const menu = screen.getByRole('link', { name: 'Open your profile' })
        expect(menu).toHaveAttribute('href', '/profile')
        // one element, one tab stop: a Link wrapping a Button is two, and axe
        // calls that a nested-interactive violation
        expect(container.querySelectorAll('a[href="/profile"]')).toHaveLength(1)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('carries no avatar and no chevron (TASK-22142)', () => {
        const { container } = renderWithIntl(<HomeTopNav showRewards={false} />)

        const link = container.querySelector('a[href="/profile"]')!
        // the sticker moved to /profile and the picker; nothing here renders it
        expect(link.querySelector('img')).not.toBeInTheDocument()
        expect(link.querySelector('[role="img"]')).not.toBeInTheDocument()
        // exactly one glyph — the menu icon. A second svg would be the chevron
        // the chip needed to read as tappable, which the button no longer does.
        expect(link.querySelectorAll('svg')).toHaveLength(1)
    })

    it('shows the rewards link only when rewards are on', () => {
        const { container, rerender } = renderWithIntl(<HomeTopNav showRewards={false} />)
        expect(container.querySelector('a[href="/rewards"]')).not.toBeInTheDocument()

        rerender(<HomeTopNav showRewards />)
        expect(container.querySelector('a[href="/rewards"]')).toBeInTheDocument()
        expect(screen.getByText('Rewards')).toBeInTheDocument()
    })
})
