import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import React from 'react'
import type { ComponentProps } from 'react'
import BadgesRow from '@/components/Badges/BadgesRow'
import { getBadgeIcon } from '@/components/Badges/badge.utils'

const render = (ui: React.ReactElement, options?: Omit<Parameters<typeof rtlRender>[1], 'wrapper'>) =>
    rtlRender(ui, { wrapper: IntlWrapper, ...options })

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, fill, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean; fill?: boolean }) => (
        <img {...rest} />
    ),
}))

jest.mock('@/components/Tooltip', () => ({
    Tooltip: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
        <>
            {children}
            {content}
        </>
    ),
}))

const badge = (code: string, earnedAt: string) => ({
    code,
    iconUrl: null,
    earnedAt,
})

describe('BadgesRow', () => {
    it('does not mutate the badges array it is given', () => {
        // Oldest first, so a newest-first sort has to reorder them.
        const badges = [
            badge('OLDEST', '2024-01-01T00:00:00.000Z'),
            badge('MIDDLE', '2024-06-01T00:00:00.000Z'),
            badge('NEWEST', '2024-12-01T00:00:00.000Z'),
        ]

        render(
            <IntlWrapper>
                <BadgesRow badges={badges} />
            </IntlWrapper>
        )

        expect(badges.map((b) => b.code)).toEqual(['OLDEST', 'MIDDLE', 'NEWEST'])
    })

    it('uses catalog self and public descriptions according to profile audience', () => {
        const catalogBadge = badge('CARD_FIRST_SWIPE', '2026-08-04T00:00:00.000Z')

        const { rerender } = render(<BadgesRow badges={[catalogBadge]} isSelfProfile />)
        expect(screen.getByText('You put your card to work.')).toBeInTheDocument()
        expect(screen.queryByText('First swipe. They put their card to work.')).not.toBeInTheDocument()

        rerender(<BadgesRow badges={[catalogBadge]} isSelfProfile={false} />)
        expect(screen.getByText('First swipe. They put their card to work.')).toBeInTheDocument()
        expect(screen.queryByText('You put your card to work.')).not.toBeInTheDocument()
    })

    it('ignores backend prose left in the payload', () => {
        const apiBadge = {
            ...badge('VERIFIED', '2026-08-04T00:00:00.000Z'),
            name: 'Backend Name',
            description: 'You earned this badge.',
            publicDescription: 'They earned this badge.',
        }

        const { rerender } = render(<BadgesRow badges={[apiBadge]} isSelfProfile />)
        expect(screen.getByText(/You're officially verified/)).toBeInTheDocument()
        expect(screen.queryByText('Backend Name')).not.toBeInTheDocument()

        rerender(<BadgesRow badges={[apiBadge]} isSelfProfile={false} />)
        expect(screen.getByText('ID checked, identity confirmed. Officially verified.')).toBeInTheDocument()
        expect(screen.queryByText('They earned this badge.')).not.toBeInTheDocument()
    })

    it('keeps an earned badge visible with generic art when the backend icon fails', () => {
        const apiBadge = {
            ...badge('NEW', '2026-08-04T00:00:00.000Z'),
            iconUrl: '/badges/missing.svg',
        }

        render(<BadgesRow badges={[apiBadge]} />)
        const image = screen.getByRole('img', { name: 'NEW' })
        expect(image).toHaveAttribute('src', apiBadge.iconUrl)

        fireEvent.error(image)

        expect(image).toHaveAttribute('src', getBadgeIcon())
    })

    it('keeps the earned Offramp badge visible independently of migration-entry policy', () => {
        render(
            <BadgesRow
                badges={[
                    {
                        ...badge('OFFRAMP_USER', '2026-08-04T00:00:00.000Z'),
                        iconUrl: '/badges/offramp_user.png',
                    },
                ]}
            />
        )

        expect(screen.getByRole('img', { name: 'Offramp User' })).toHaveAttribute('src', '/badges/offramp_user.png')
    })
})
