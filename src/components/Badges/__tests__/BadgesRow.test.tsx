import { render as rtlRender } from '@testing-library/react'
import React from 'react'
import { NextIntlClientProvider } from 'next-intl'
import enMessages from '@/i18n/app/messages/en.json'
import type { ComponentProps } from 'react'
import BadgesRow from '@/components/Badges/BadgesRow'

const IntlWrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)

const render = (ui: React.ReactElement, options?: Omit<Parameters<typeof rtlRender>[1], 'wrapper'>) =>
    rtlRender(ui, { wrapper: IntlWrapper, ...options })

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

        render(<BadgesRow badges={badges} />)

        expect(badges.map((b) => b.code)).toEqual(['OLDEST', 'MIDDLE', 'NEWEST'])
    })
})
