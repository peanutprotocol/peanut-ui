import { render, screen } from '@testing-library/react'
import { createMdxComponents } from '../mdx/components'
import { ContentPage } from '../ContentPage'
import { getTranslations } from '@/i18n'

// The strip and the widget are third-party/client heavy; only the copy they
// receive matters here.
jest.mock('@/components/Global/MarqueeWrapper', () => ({
    MarqueeComp: ({ message }: { message: string[] }) => <p data-testid="marquee">{message.join(' | ')}</p>,
}))
jest.mock('@/components/Global/ExchangeRateWidget', () => ({
    __esModule: true,
    default: ({ ctaLabel, labels }: { ctaLabel: string; labels?: { youSend?: string } }) => (
        <p data-testid="exchange">
            {ctaLabel} | {labels?.youSend}
        </p>
    ),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('nuqs', () => ({
    parseAsString: {},
    useQueryStates: () => [{ from: null, to: null }, jest.fn()],
}))

const ptBr = getTranslations('pt-br')

describe('MDX components on a pt-br page', () => {
    const { Hero, ExchangeWidget } = createMdxComponents('pt-br')

    it('renders the Hero marquee in the page locale', () => {
        render(<Hero title="Título" />)
        expect(screen.getByTestId('marquee').textContent).toBe(
            [ptBr.heroMarqueeNoFees, ptBr.heroMarqueeInstant, '24/7', ptBr.heroMarqueeDollars, 'USDT/USDC'].join(' | ')
        )
    })

    it('passes the landing widget copy to ExchangeWidget', () => {
        render(<ExchangeWidget destinationCurrency="BRL" />)
        expect(screen.getByTestId('exchange').textContent).toBe(`${ptBr.sendMoney} | ${ptBr.exchangeYouSend}`)
    })
})

describe('ContentPage on a fallback page', () => {
    const jsonLd = (container: HTMLElement) =>
        [...container.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.innerHTML))

    it('names the content locale in the article schema and translates the breadcrumb label', () => {
        const { container } = render(
            <ContentPage
                locale="pt-br"
                contentLocale="en"
                breadcrumbs={[{ name: ptBr.home, href: '/pt-br' }]}
                article={{ title: 'T', description: 'D', url: '/pt-br/help/x', datePublished: '2026-01-01' }}
            >
                <p>body</p>
            </ContentPage>
        )

        const article = jsonLd(container).find((schema) => schema['@type'] !== 'BreadcrumbList')
        expect(article.inLanguage).toBe('en')
        expect(screen.getByRole('navigation', { name: ptBr.breadcrumbLabel })).toBeTruthy()
    })

    it('falls back to the route locale when no content locale is given', () => {
        const { container } = render(
            <ContentPage
                locale="pt-br"
                breadcrumbs={[{ name: ptBr.home, href: '/pt-br' }]}
                article={{ title: 'T', description: 'D', url: '/pt-br/help/x', datePublished: '2026-01-01' }}
            >
                <p>body</p>
            </ContentPage>
        )

        const article = jsonLd(container).find((schema) => schema['@type'] !== 'BreadcrumbList')
        expect(article.inLanguage).toBe('pt-br')
    })
})
