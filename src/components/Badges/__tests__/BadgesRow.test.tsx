import { render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import BadgesRow from '@/components/Badges/BadgesRow'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, fill, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean; fill?: boolean }) => (
        <img {...rest} />
    ),
}))

jest.mock('@/components/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
            <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
                <BadgesRow badges={badges} />
            </NextIntlClientProvider>
        )

        expect(badges.map((b) => b.code)).toEqual(['OLDEST', 'MIDDLE', 'NEWEST'])
    })
})
