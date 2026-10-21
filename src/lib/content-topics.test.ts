import sitemap from '@/app/sitemap'
import { CONTENT_TOPICS } from './content-topic-types'
import { listContentTopic, listCountryGuides } from './content-topics'
import * as content from './content'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { isGoneMarketingPath } from '@/constants/gone-routes.consts'

describe('content topic discovery', () => {
    afterEach(() => jest.restoreAllMocks())

    it('links every canonical sitemap guide from a topic directory', async () => {
        const topicPaths = new Set(
            SUPPORTED_LOCALES.flatMap((locale) =>
                CONTENT_TOPICS.flatMap((topic) => listContentTopic(topic, locale))
            ).map(({ href }) => href)
        )
        const guidePaths = (await sitemap())
            .map(({ url }) => new URL(url).pathname)
            .filter((path) =>
                /^\/(en|es-419|es-ar|pt-br)\/(deposit\/|receive-money-from\/|send-money-(from|to)\/|pay-with\/|withdraw\/)/.test(
                    path
                )
            )
        expect(guidePaths.length).toBeGreaterThan(300)
        expect(guidePaths.filter((path) => !topicPaths.has(path))).toEqual([])
    })

    it('uses real deposit routes and connects the missed country and wallet guides', () => {
        const deposits = listContentTopic('deposit', 'en').map(({ href }) => href)
        expect(deposits).toContain('/en/deposit/from-coinbase')
        expect(deposits).toContain('/en/deposit/via-ach')
        expect(deposits).not.toContain('/en/deposit/from-ach')
        expect(listContentTopic('countries', 'en').map(({ href }) => href)).toContain('/en/chile')
        expect(listContentTopic('withdraw', 'en').map(({ href }) => href)).toContain('/en/withdraw/ethereum')
    })

    it('links to the published content owner when a regional translation is absent', () => {
        expect(listContentTopic('countries', 'es-ar').find(({ href }) => href.endsWith('/poland'))).toMatchObject({
            href: '/es-419/poland',
            lang: 'es-419',
        })
    })

    it('preserves planned-method titles and descriptions instead of implying availability', () => {
        const venmo = listContentTopic('pay', 'en').find(({ href }) => href.endsWith('/venmo'))!
        const source = content.readPageContent('pay-with', 'venmo', 'en')!
        expect(venmo.title).toBe(source.frontmatter.title)
        expect(venmo.description).toBe(source.frontmatter.description)
        expect(venmo.title).toContain('Planned')
    })

    it('omits content with no published locale and retired routes', () => {
        const original = content.readPageContentLocalizedResolved
        jest.spyOn(content, 'readPageContentLocalizedResolved').mockImplementation((intent, slug, locale) =>
            slug === 'coinbase' ? null : original(intent, slug, locale)
        )
        expect(listContentTopic('deposit', 'en').some(({ href }) => href.endsWith('/from-coinbase'))).toBe(false)
        expect(
            CONTENT_TOPICS.flatMap((topic) => listContentTopic(topic, 'en')).some(({ href }) =>
                isGoneMarketingPath(href)
            )
        ).toBe(false)
    })

    it('does not link an unpublished corridor whose route would return notFound', () => {
        const original = content.readCorridorContent
        jest.spyOn(content, 'readCorridorContent').mockImplementation((to, from, locale) => {
            if (to === 'brazil' && from === 'united-states' && locale === 'es-ar') {
                return { frontmatter: { published: false }, body: '' }
            }
            return original(to, from, locale)
        })
        expect(
            listContentTopic('send', 'es-ar').some(({ href }) =>
                href.endsWith('/send-money-from/united-states/to/brazil')
            )
        ).toBe(false)
    })

    it('connects country guides only to their own receiving, destination and corridor pages', () => {
        const links = listCountryGuides('united-states', 'en').map(({ href }) => href)
        expect(links).toContain('/en/receive-money-from/united-states')
        expect(links).toContain('/en/send-money-from/united-states/to/brazil')
        expect(links).not.toContain('/en/send-money-from/mexico/to/argentina')
        expect(links.every((href) => href.split('/').includes('united-states'))).toBe(true)
    })

    it('advertises all topic entrypoints in the sitemap', async () => {
        const paths = new Set((await sitemap()).map(({ url }) => new URL(url).pathname))
        for (const locale of SUPPORTED_LOCALES) {
            for (const topic of CONTENT_TOPICS) expect(paths.has(`/${locale}/content/${topic}`)).toBe(true)
        }
    })
})
