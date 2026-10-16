import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { Badges } from '../index'
import en from '@/i18n/app/messages/en.json'
import type { BadgeCatalogEntry } from '@/services/badges'
import type { AppLocale } from '@/i18n/app/config'

const catalog: BadgeCatalogEntry[] = [
    {
        code: 'CARD_FIRST_SWIPE',
        name: 'First Swipe',
        description: 'You put your card to work.',
        publicDescription: 'They put their card to work.',
        shareLine: 'I earned it.',
        iconUrl: '/badges/happy_card.svg',
        unlock: { kind: 'card_purchase' },
        earnable: true,
    },
    {
        code: 'TRON',
        name: 'Tron Native',
        description: 'Found on Tron.',
        publicDescription: 'Found on Tron.',
        shareLine: 'I earned it.',
        iconUrl: '/badges/tron.svg',
        unlock: { kind: 'campaign' },
        earnable: true,
    },
]

const mockGetBadgeCatalog = jest.fn(() => Promise.resolve(catalog))
jest.mock('@/services/badges', () => ({ getBadgeCatalog: () => mockGetBadgeCatalog() }))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { badges: [{ code: 'OG_2025_10_12', name: 'OG', earnedAt: '2026-01-01T00:00:00Z' }] } },
        fetchUser: jest.fn(),
    }),
}))

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('../BadgeImage', () => ({ BadgeImage: () => null }))

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const tree = (queryClient: QueryClient, locale: AppLocale) => (
    <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale={locale} messages={en}>
            <Badges />
        </NextIntlClientProvider>
    </QueryClientProvider>
)

function renderBadges() {
    return render(tree(client(), 'en'))
}

describe('Badges gallery', () => {
    it('ends the grid with one mystery tile, after the earned and earnable badges', async () => {
        renderBadges()

        const grid = await screen.findByLabelText(en.badges.collectionLabel)
        const tiles = Array.from(grid.children)

        expect(within(grid).getAllByText(en.badges.mystery.title)).toHaveLength(1)
        expect(tiles).toHaveLength(4)
        expect(tiles[0]).toHaveTextContent('OG')
        expect(tiles[3]).toHaveTextContent(en.badges.mystery.title)
        expect(tiles[3]).toHaveTextContent(en.badges.mystery.description)
        // a hint, not something to earn: nothing to press
        expect(within(tiles[3] as HTMLElement).queryByRole('button')).toBeNull()
        expect(tiles[3].tagName).not.toBe('BUTTON')
    })

    it('refetches the api-localized catalog after a language switch', async () => {
        mockGetBadgeCatalog.mockClear()
        const queryClient = client()
        const { rerender } = render(tree(queryClient, 'en'))
        await screen.findByLabelText(en.badges.collectionLabel)
        expect(mockGetBadgeCatalog).toHaveBeenCalledTimes(1)

        rerender(tree(queryClient, 'es-419'))

        await waitFor(() => expect(mockGetBadgeCatalog).toHaveBeenCalledTimes(2))
    })
})
