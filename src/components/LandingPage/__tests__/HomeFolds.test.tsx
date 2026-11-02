import { render, within } from '@testing-library/react'
import { getTranslations } from '@/i18n'
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/types'
import { HomeFolds } from '../HomeFolds'
import { EN_LANDING_CONTENT_HREFS } from '../landingContentHrefs'
import { landingStrings } from '../landingStrings'

let cardFoldDisabled = false

jest.mock('@/hooks/useFeatureFlag', () => ({
    useFeatureFlags: () => () => cardFoldDisabled,
}))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
// No AuthProvider mock: the home renders with none above it, as these folds must survive.
jest.mock('@/components/Migration/AppModalProvider', () => ({ useAppModal: () => () => false }))
jest.mock('@/features/marketing-qr/consent', () => ({ marketingQrAnalyticsAllowed: () => false }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
// The rate widget fetches live rates; the fold around it is what these tests cover.
jest.mock('@/components/Global/ExchangeRateWidget', () => ({
    __esModule: true,
    default: () => <div data-testid="rates" />,
}))
jest.mock('react-qr-code', () => ({
    __esModule: true,
    default: ({ value }: { value: string }) => <div data-testid="qr" data-value={value} />,
}))

const FAQ_ITEMS = [
    { id: 'who-can-pay', question: 'Who can pay me?', answer: 'Employers and business clients.' },
    { id: 'cost', question: 'What does it cost?', answer: 'No Peanut fee to open or keep your accounts.' },
]

function renderHome(locale: Locale = 'en') {
    return render(
        <HomeFolds
            locale={locale}
            strings={landingStrings(getTranslations(locale))}
            contentHrefs={EN_LANDING_CONTENT_HREFS}
            faqItems={FAQ_ITEMS}
            closeCta={{ label: 'Sign up', href: '/setup' }}
        />
    )
}

const foldIds = (container: HTMLElement) => Array.from(container.querySelectorAll('section[id]'), (s) => s.id)

describe('HomeFolds', () => {
    beforeEach(() => {
        cardFoldDisabled = false
    })

    it('renders the folds in the round-2 order', () => {
        const { container } = renderHome()
        expect(foldIds(container)).toEqual([
            'home-get-paid',
            'home-request',
            'home-balance',
            'peanut-card',
            'home-pay-local',
            'security',
            'no-fees',
            'wall-of-love',
            'faq',
            'home-close',
        ])
    })

    it('puts a ticker on every seam: each fold is followed by one, the close by the last before the footer', () => {
        const { container } = renderHome()
        const children = Array.from(container.querySelector('#home-get-paid')!.parentElement!.children)
        const tickers = children.filter((el) => el.classList.contains('star-lp-marquee'))
        // eleven folds (the persona fold has no id), so eleven seams below them, the footer seam included
        expect(tickers).toHaveLength(11)
        children.forEach((el, i) => {
            if (!el.classList.contains('star-lp-marquee')) {
                expect(children[i + 1]?.classList.contains('star-lp-marquee')).toBe(true)
            }
        })
        expect(children.at(-1)?.classList.contains('star-lp-marquee')).toBe(true)
    })

    it('drops the card fold and its ticker when the kill switch is on, keeping a ticker on the new seam', () => {
        cardFoldDisabled = true
        const { container } = renderHome()
        expect(container.querySelector('#peanut-card')).toBeNull()
        expect(container.querySelectorAll('.star-lp-marquee')).toHaveLength(10)
        const payLocal = container.querySelector('#home-pay-local')!
        expect(payLocal.previousElementSibling?.classList.contains('star-lp-marquee')).toBe(true)
    })

    it('has no black trust band: the security fold carries trust', () => {
        const { container } = renderHome()
        expect(container.textContent).not.toMatch(/can't freeze/i)
    })

    it('shows real posts only, each linking to its post on X', () => {
        const { container } = renderHome()
        const posts = Array.from(container.querySelectorAll('#wall-of-love a'))
        expect(posts).toHaveLength(6)
        for (const a of posts) {
            expect(a.getAttribute('href')).toMatch(/^https:\/\/x\.com\/\w+\/status\/\d+$/)
            expect(a).toHaveAttribute('rel', 'noopener noreferrer')
        }
    })

    it('emits one FAQPage JSON-LD, from the FAQ fold', () => {
        const { container } = renderHome()
        const schemas = Array.from(container.querySelectorAll('script[type="application/ld+json"]'), (s) =>
            JSON.parse(s.textContent ?? '{}')
        ).filter((schema) => schema['@type'] === 'FAQPage')
        expect(schemas).toHaveLength(1)
        expect(schemas[0].mainEntity).toHaveLength(FAQ_ITEMS.length)
    })

    it('repeats the hero CTA in the close', () => {
        const { container } = renderHome()
        const close = container.querySelector('#home-close a')
        expect(close).toHaveTextContent('Sign up')
        expect(close).toHaveAttribute('href', '/setup')
    })

    it('keeps every art link (out of the tab order) hidden from assistive tech', () => {
        const { container } = renderHome()
        const artLinks = Array.from(container.querySelectorAll('a[tabindex="-1"]'))
        expect(artLinks.length).toBeGreaterThan(0)
        for (const a of artLinks) expect(a.closest('[aria-hidden="true"], [role="img"]')).not.toBeNull()
    })

    it.each(SUPPORTED_LOCALES)('%s renders with every string filled', (locale) => {
        const { container } = renderHome(locale)
        const text = container.textContent ?? ''
        expect(text).not.toMatch(/undefined|\{(username|main|payer|amount|argentina|brazil)\}/)
        const labels = Array.from(container.querySelectorAll('[aria-label]'), (el) => el.getAttribute('aria-label'))
        for (const label of labels) expect(label).not.toMatch(/undefined|\{\w+\}/)
    })

    it.each(SUPPORTED_LOCALES)('%s exposes all six feature pages in their relevant folds', (locale) => {
        const { container } = renderHome(locale)
        const routes = [
            ['home-get-paid', '/us-europe-accounts'],
            ['home-request', '/request-links'],
            ['peanut-card', '/peanut-card'],
            ['home-pay-local', '/qr-payments/argentina'],
            ['home-pay-local', '/qr-payments/brazil'],
            ['security', '/self-custody'],
        ]
        for (const [foldId, href] of routes) {
            const fold = container.querySelector<HTMLElement>(`#${foldId}`)!
            const link = within(fold)
                .getAllByRole('link')
                .find((a) => a.getAttribute('href') === href)
            expect(link).toBeDefined()
            expect(link).toHaveAttribute('hrefLang', 'en')
            if (locale !== 'en') {
                const languageLabel = getTranslations(locale).inEnglish
                if (foldId === 'peanut-card') expect(link).toHaveAccessibleDescription(languageLabel)
                else expect(link).toHaveTextContent(languageLabel)
            }
        }
        const custody = container.querySelector('a[href="/self-custody"]')!
        const controlColumn = custody.closest('.flex-1') as HTMLElement
        expect(within(controlColumn).getByRole('heading', { level: 3 })).toHaveTextContent(
            getTranslations(locale).landingSecurityControlTitle
        )
        expect(controlColumn.querySelectorAll('a')).toHaveLength(2)
        // The account art still opens the app; the new text link adds the feature explainer.
        const accountHrefs = Array.from(container.querySelectorAll('#home-get-paid a'), (a) => a.getAttribute('href'))
        expect(accountHrefs).toContain('/setup?redirect_uri=%2Fadd-money%3Fmethod%3Dbank')
    })
})
