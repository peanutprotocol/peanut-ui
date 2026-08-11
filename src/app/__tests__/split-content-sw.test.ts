import { SPLIT_RELEASED_GUIDE_PATHS, splitContentServiceWorkerMatcher } from '@/utils/split-content-edge'

const matches = (pathname: string) => splitContentServiceWorkerMatcher({ url: new URL(pathname, 'https://peanut.me') })

describe('parent service-worker Split isolation', () => {
    it.each([...SPLIT_RELEASED_GUIDE_PATHS, '/split-static/_next/static/chunks/app.js', '/split-sitemap.xml'])(
        'uses NetworkOnly matching for forwarded path %s',
        (pathname) => {
            expect(matches(pathname)).toBe(true)
        }
    )

    it.each([
        '/split',
        '/split/unknown',
        '/en/split/guides/unknown',
        '/fr/split/guides/split-expenses-across-currencies',
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

    it.each(['/home', '/en', '/relay/e/', '/splitter', '/en/splitter/page', '/en/travel%20guide'])(
        'does not claim unrelated parent path %s',
        (pathname) => {
            expect(matches(pathname)).toBe(false)
        }
    )
})
