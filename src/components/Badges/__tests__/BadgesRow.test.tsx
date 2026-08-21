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
    name: code,
    description: null,
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

    it('uses backend self and public descriptions according to profile audience', () => {
        const apiBadge = {
            ...badge('NEW', '2026-08-04T00:00:00.000Z'),
            description: 'You earned this badge.',
            publicDescription: 'They earned this badge.',
        }

        const { rerender } = render(<BadgesRow badges={[apiBadge]} isSelfProfile />)
        expect(screen.getByText('You earned this badge.')).toBeInTheDocument()
        expect(screen.queryByText('They earned this badge.')).not.toBeInTheDocument()

        rerender(<BadgesRow badges={[apiBadge]} isSelfProfile={false} />)
        expect(screen.getByText('They earned this badge.')).toBeInTheDocument()
        expect(screen.queryByText('You earned this badge.')).not.toBeInTheDocument()
    })

    // The test above uses a code with no `badges.catalog` entry, so it passes even
    // if the localized copy swallows the audience choice. This one uses a real code.
    it('keeps the backend public description for a badge that IS in the catalog', () => {
        const apiBadge = {
            ...badge('VERIFIED', '2026-08-04T00:00:00.000Z'),
            description: 'You earned this badge.',
            publicDescription: 'They earned this badge.',
        }

        const { rerender } = render(<BadgesRow badges={[apiBadge]} isSelfProfile />)
        expect(screen.getByText(/officially verified/)).toBeInTheDocument()

        rerender(<BadgesRow badges={[apiBadge]} isSelfProfile={false} />)
        expect(screen.getByText('They earned this badge.')).toBeInTheDocument()
        expect(screen.queryByText(/officially verified/)).not.toBeInTheDocument()
    })

    it('keeps an earned badge visible with generic art when the backend icon fails', () => {
        const apiBadge = {
            ...badge('NEW', '2026-08-04T00:00:00.000Z'),
            name: 'Backend Badge',
            iconUrl: '/badges/missing.svg',
        }

        render(<BadgesRow badges={[apiBadge]} />)
        const image = screen.getByRole('img', { name: 'Backend Badge' })
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
                        name: 'Offramp User',
                        iconUrl: '/badges/offramp_user.png',
                    },
                ]}
            />
        )

        expect(screen.getByRole('img', { name: 'Offramp User' })).toHaveAttribute('src', '/badges/offramp_user.png')
    })
})
