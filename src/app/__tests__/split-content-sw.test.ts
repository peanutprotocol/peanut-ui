import {
    SPLIT_CANARY_GUIDE_PATHS,
    SPLIT_CONTENT_RESERVED_PATH_PREFIXES,
    splitContentServiceWorkerMatcher,
} from '@/utils/split-content-edge'

const matches = (pathname: string) => splitContentServiceWorkerMatcher({ url: new URL(pathname, 'https://peanut.me') })

describe('parent service-worker Split isolation', () => {
    it.each([...SPLIT_CANARY_GUIDE_PATHS, '/split-static/_next/static/chunks/app.js', '/split-sitemap.xml'])(
        'uses NetworkOnly matching for forwarded path %s',
        (pathname) => {
            expect(matches(pathname)).toBe(true)
        }
    )

    it.each([
        '/split',
        '/split/unknown',
        '/en/split',
        '/en/split/guides/unknown',
        '/pt-br/split/alternatives/splitwise',
        '/en/split/tools',
        '/en/split/tools/rent-split-calculator',
        '/es-419/split/tools',
        '/pt-br/split/tools/rent-split-calculator',
        '/fr/split/guides/split-expenses-across-currencies',
        '/es/split/guides/future-guide',
        '/es-es/split/tools/rent-split-calculator',
        '/pt/split/alternatives/future-alternative',
        '/sh/split',
        '/zh-hans-cn/split/guides/future-guide',
        '/split-static',
        '/split-sitemap.xml/extra',
    ])('also keeps negative namespace path %s out of parent caches and fallbacks', (pathname) => {
        expect(matches(pathname)).toBe(true)
    })

    it.each([
        '/en/%73plit/guides/unknown',
        '/en/split%2Fguides/unknown',
        '/en/%2Fsplit/guides/unknown',
        '/%2Fsplit-static/a.js',
        '/split%2Dstatic/a.js',
        '/split%2Dsitemap.xml',
        '/en/%2573plit/guides/unknown',
    ])('keeps encoded Split representation %s out of parent caches and fallbacks', (pathname) => {
        expect(matches(pathname)).toBe(true)
    })

    it.each([
        '/home',
        '/en',
        '/relay/e/',
        '/splitter',
        '/en/splitter/page',
        '/en/travel%20guide',
        '/hugo/split',
        '/alice/split',
    ])('does not claim unrelated parent path %s', (pathname) => {
        expect(matches(pathname)).toBe(false)
    })

    it.each(SPLIT_CONTENT_RESERVED_PATH_PREFIXES)(
        'does not claim the existing product namespace %s/split',
        (prefix) => {
            expect(matches(`${prefix}/split`)).toBe(false)
            expect(matches(`${prefix}/%73plit`)).toBe(false)
        }
    )
})
