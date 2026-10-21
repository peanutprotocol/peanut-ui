import sitemap from '@/app/sitemap'
import { CONTENT_TOPICS } from './content-topic-types'
import { listContentTopic, listContentTopics, listCountryGuides } from './content-topics'
import * as content from './content'
import { CORRIDORS, RECEIVE_SOURCES, SEND_TO_COUNTRIES } from '@/data/seo'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { isGoneMarketingPath } from '@/constants/gone-routes.consts'

const originalCorridors = [...CORRIDORS]
const originalReceiveSources = [...RECEIVE_SOURCES]
const originalSendDestinations = [...SEND_TO_COUNTRIES]

describe('content topic discovery', () => {
    afterEach(() => {
        jest.restoreAllMocks()
        CORRIDORS.splice(0, CORRIDORS.length, ...originalCorridors)
        RECEIVE_SOURCES.splice(0, RECEIVE_SOURCES.length, ...originalReceiveSources)
        SEND_TO_COUNTRIES.splice(0, SEND_TO_COUNTRIES.length, ...originalSendDestinations)
    })

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
        expect(guidePaths.length).toBeGreaterThan(40)
        expect(guidePaths.filter((path) => !topicPaths.has(path))).toEqual([])
    })

    it('uses the real retained account, bank, country and withdrawal routes', () => {
        const deposits = listContentTopic('deposit', 'en').map(({ href }) => href)
        expect(deposits).toContain('/en/deposit/from-usd-account')
        expect(deposits).toContain('/en/deposit/via-ach')
        expect(deposits).not.toContain('/en/deposit/from-ach')
        expect(listContentTopic('countries', 'en').map(({ href }) => href)).toContain('/en/argentina')
        expect(listContentTopic('withdraw', 'en').map(({ href }) => href)).toContain('/en/withdraw/faster-payments')
    })

    it('links to the published content owner when a regional translation is absent', () => {
        expect(
            listContentTopic('deposit', 'es-ar').find(({ href }) => href.endsWith('/from-usd-account'))
        ).toMatchObject({
            href: '/es-419/deposit/from-usd-account',
            lang: 'es-419',
        })
    })

    it('preserves authored titles and descriptions instead of inventing availability claims', () => {
        const pix = listContentTopic('pay', 'en').find(({ href }) => href.endsWith('/pix'))!
        const source = content.readPageContent('pay-with', 'pix', 'en')!
        expect(pix.title).toBe(source.frontmatter.title)
        expect(pix.description).toBe(source.frontmatter.description)
    })

    it('omits content with no published locale and retired routes', () => {
        const original = content.readPageContentLocalizedResolved
        jest.spyOn(content, 'readPageContentLocalizedResolved').mockImplementation((intent, slug, locale) =>
            slug === 'usd-account' ? null : original(intent, slug, locale)
        )
        expect(listContentTopic('deposit', 'en').some(({ href }) => href.endsWith('/from-usd-account'))).toBe(false)
        expect(
            CONTENT_TOPICS.flatMap((topic) => listContentTopic(topic, 'en')).some(({ href }) =>
                isGoneMarketingPath(href)
            )
        ).toBe(false)
    })

    it('does not link an unpublished corridor whose route would return notFound', () => {
        CORRIDORS.splice(0, CORRIDORS.length, { from: 'fixture-origin', to: 'fixture-destination' })
        jest.spyOn(content, 'readCorridorContent').mockReturnValue({
            frontmatter: { published: false },
            body: '',
        })
        expect(listContentTopic('send', 'es-ar').some(({ href }) => href.includes('/fixture-origin/'))).toBe(false)
    })

    it('connects country guides only to their own published receiving, destination and corridor pages', () => {
        RECEIVE_SOURCES.splice(0, RECEIVE_SOURCES.length, 'fixture-origin')
        SEND_TO_COUNTRIES.splice(0, SEND_TO_COUNTRIES.length, 'fixture-origin')
        CORRIDORS.splice(
            0,
            CORRIDORS.length,
            { from: 'fixture-origin', to: 'brazil' },
            { from: 'other-country', to: 'argentina' }
        )
        jest.spyOn(content, 'readPageContentLocalizedResolved').mockReturnValue({
            content: { frontmatter: { title: 'Fixture', description: 'Fixture', published: true }, body: '' },
            lang: 'en',
        })
        jest.spyOn(content, 'readCorridorContent').mockReturnValue({
            frontmatter: { title: 'Fixture', description: 'Fixture', published: true },
            body: '',
        })
        const links = listCountryGuides('fixture-origin', 'en').map(({ href }) => href)
        expect(links).toEqual(
            expect.arrayContaining([
                '/en/receive-money-from/fixture-origin',
                '/en/send-money-to/fixture-origin',
                '/en/send-money-from/fixture-origin/to/brazil',
            ])
        )
        expect(links.every((href) => href.split('/').includes('fixture-origin'))).toBe(true)
    })

    it('removes empty topics from navigation and sitemap without removing populated topics', async () => {
        RECEIVE_SOURCES.splice(0, RECEIVE_SOURCES.length)
        SEND_TO_COUNTRIES.splice(0, SEND_TO_COUNTRIES.length)
        CORRIDORS.splice(0, CORRIDORS.length)
        const paths = new Set((await sitemap()).map(({ url }) => new URL(url).pathname))
        for (const locale of SUPPORTED_LOCALES) {
            expect(listContentTopics(locale)).toEqual(['countries', 'deposit', 'pay', 'withdraw'])
            expect(paths.has(`/${locale}/content/send`)).toBe(false)
            expect(paths.has(`/${locale}/content/receive`)).toBe(false)
            for (const topic of ['countries', 'deposit', 'pay', 'withdraw']) {
                expect(paths.has(`/${locale}/content/${topic}`)).toBe(true)
            }
        }
    })
})
