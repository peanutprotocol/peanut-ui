/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import DocsLink from '../DocsLink'
import { AppHelpProvider } from '../AppHelpProvider'
import { APP_HELP_SLUGS, type AppHelpArticle, type AppHelpNode } from '../appHelpTypes'
import en from '@/i18n/app/messages/en.json'

jest.mock('@/hooks/usePWAStatus', () => ({ usePWAStatus: () => false }))
const mockSetSupportOpen = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockSetSupportOpen }),
}))
const mockCaptureException = jest.fn()
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

/** Article files the fetch mock serves, keyed by path; anything else is a 404. */
let served: Record<string, AppHelpArticle> = {}
const fetchMock = jest.fn(async (url: string) => {
    const article = served[url]
    return { ok: Boolean(article), json: async () => article } as Response
})

const article = (slug: string, locale: string, body?: AppHelpNode[]): AppHelpArticle => ({
    title: `${slug} ${locale}`,
    body: body ?? [{ t: 'p', c: [`${slug} article ${locale}`] }],
})
const serve = (slug: string, locale: string, body?: AppHelpNode[]) => {
    served[`/app-help/${locale}/${slug}.json`] = article(slug, locale, body)
}

function renderLink(locale: 'en' | 'es-419' | 'es-AR' | 'pt-BR', href: string) {
    render(
        <NextIntlClientProvider locale={locale} messages={en} timeZone="UTC">
            <AppHelpProvider>
                <DocsLink href={href}>Read help</DocsLink>
            </AppHelpProvider>
        </NextIntlClientProvider>
    )
}

const openHelp = () => fireEvent.click(screen.getByRole('button', { name: 'Read help' }))

beforeEach(() => {
    served = {}
    fetchMock.mockClear()
    mockCaptureException.mockClear()
    global.fetch = fetchMock as unknown as typeof fetch
})

// Articles loaded in one test stay cached for the session, so each test uses
// its own slug and locale pair where the fetch calls matter.
describe('app help drawers', () => {
    it('fetches nothing until a help link is opened', () => {
        renderLink('en', '/en/help/verification')
        expect(screen.getByRole('button', { name: 'Read help' })).toBeInTheDocument()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it.each(APP_HELP_SLUGS)('opens the %s article on its own, without navigation', async (slug) => {
        APP_HELP_SLUGS.forEach((each) => serve(each, 'en'))
        const pathname = window.location.pathname
        renderLink('en', `/en/help/${slug}`)
        openHelp()
        expect(await screen.findByText(`${slug} article en`)).toBeInTheDocument()
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`/app-help/en/${slug}.json`])
        expect(window.location.pathname).toBe(pathname)
    })

    it.each([
        ['es-419', 'es-419'],
        ['es-AR', 'es-ar'],
        ['pt-BR', 'pt-br'],
    ] as const)('loads the %s article', async (locale, expected) => {
        serve('transaction-limits', expected)
        renderLink(locale, '/en/help/transaction-limits')
        openHelp()
        expect(await screen.findByText(`transaction-limits article ${expected}`)).toBeInTheDocument()
    })

    it('falls back to the English article when the locale has none', async () => {
        serve('request-money', 'en')
        renderLink('pt-BR', '/en/help/request-money')
        openHelp()
        expect(await screen.findByText('request-money article en')).toBeInTheDocument()
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            '/app-help/pt-br/request-money.json',
            '/app-help/en/request-money.json',
        ])
    })

    it('opens the public help page and reports to Sentry when the article is missing', async () => {
        const opened = { opener: {} }
        const openSpy = jest.spyOn(window, 'open').mockReturnValue(opened as unknown as Window)
        renderLink('es-AR', '/en/help/card-collateral')
        openHelp()
        await waitFor(() => expect(openSpy).toHaveBeenCalledWith('/es-ar/help/card-collateral', '_blank'))
        expect(opened.opener).toBeNull()
        expect(mockCaptureException).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'App help article unavailable: card-collateral/es-ar' }),
            expect.objectContaining({ tags: { feature: 'app-help' } })
        )
        expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('data-state', 'closed')
        openSpy.mockRestore()
    })

    it('ignores a load that fails after the drawer closes, and retries on reopen', async () => {
        const openSpy = jest.spyOn(window, 'open')
        let finishFirstLoad: (response: Response) => void = () => undefined
        fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (finishFirstLoad = resolve)))
        renderLink('es-AR', '/en/help/request-money')
        openHelp()
        fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
        finishFirstLoad({ ok: false } as Response)
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        await act(async () => undefined)
        expect(openSpy).not.toHaveBeenCalled()
        expect(mockCaptureException).not.toHaveBeenCalled()

        serve('request-money', 'es-ar')
        // The page stays aria-hidden while the closed drawer finishes its exit in jsdom.
        fireEvent.click(screen.getByRole('button', { name: 'Read help', hidden: true }))
        expect(await screen.findByText('request-money article es-ar')).toBeInTheDocument()
        openSpy.mockRestore()
    })

    it('leaves the full help center link available', () => {
        renderLink('en', '/en/help')
        expect(screen.getByRole('link', { name: 'Read help' })).toHaveAttribute('href', '/en/help')
    })

    it('uses a prominent h2 and an accessible icon to close the article', async () => {
        serve('verification', 'en')
        renderLink('en', '/en/help/verification')
        openHelp()
        expect(await screen.findByRole('heading', { level: 2, name: 'verification en' })).toHaveClass('text-heading-s')
        const close = screen.getByRole('button', { name: 'Close' })
        expect(close).not.toHaveTextContent('Close')
        fireEvent.click(close)
        expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('data-state', 'closed')
    })

    it('follows links inside an article to other pages and other help articles', async () => {
        serve('passkeys', 'es-419', [
            { t: 'a', p: { href: '/es-419/help/refunds' }, c: ['Refunds'] },
            { t: 'a', p: { href: '/es-419/help/account-recovery' }, c: ['Recovery'] },
        ])
        serve('account-recovery', 'es-419')
        renderLink('es-419', '/en/help/passkeys')
        openHelp()
        expect(await screen.findByRole('link', { name: 'Refunds' })).toHaveAttribute('href', '/es-419/help/refunds')
        fireEvent.click(screen.getByRole('button', { name: 'Recovery' }))
        expect(await screen.findByText('account-recovery article es-419')).toBeInTheDocument()
    })

    it('closes the article and opens in-app support from its localized CTA', async () => {
        mockSetSupportOpen.mockClear()
        serve('security-disclosure', 'pt-br', [{ t: 'CTA', p: { href: '#chat', text: 'Chat with Support' } }])
        renderLink('pt-BR', '/en/help/security-disclosure')
        openHelp()
        fireEvent.click(await screen.findByRole('button', { name: 'Chat with Support' }))
        expect(mockSetSupportOpen).toHaveBeenCalledWith(true)
        expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('data-state', 'closed')
    })

    it('renders only the text of tags and components the drawer does not know', async () => {
        serve('verification', 'es-419', [
            { t: 'script', c: ['kept as text'] },
            { t: 'ExchangeWidget', p: { from: 'USD' }, c: ['widget text'] },
            { t: 'Hero', p: { title: 'Hidden hero' } },
        ])
        renderLink('es-419', '/en/help/verification')
        openHelp()
        const dialog = await screen.findByRole('dialog')
        expect(await screen.findByText(/kept as text/)).toBeInTheDocument()
        expect(dialog.querySelector('script')).toBeNull()
        expect(dialog).toHaveTextContent('widget text')
        expect(dialog).not.toHaveTextContent('Hidden hero')
    })
})
