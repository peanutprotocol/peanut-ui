import {
    classifySplitA2Request,
    isSplitA2CanaryEnabled,
    isSplitContentPathname,
    splitContentOrigin,
} from '@/utils/split-content-edge'

describe('Split A2 edge route classification', () => {
    it('classifies the exact fixture as HTML or RSC without reading its query', () => {
        expect(classifySplitA2Request('/en/split/a2-transport', null)).toEqual({ action: 'forward', kind: 'html' })
        expect(classifySplitA2Request('/en/split/a2-transport', '1')).toEqual({ action: 'forward', kind: 'rsc' })
    })

    it.each([
        ['/split-static/_next/static/chunks/a.js', 'asset'],
        ['/split-static/images/a.png', 'asset'],
        ['/split-sitemap.xml', 'sitemap'],
        ['/_split-a2/headers', 'headers-proof'],
        ['/_split-a2/set-cookie', 'set-cookie-proof'],
    ] as const)('forwards %s as %s', (pathname, kind) => {
        expect(classifySplitA2Request(pathname, null)).toEqual({ action: 'forward', kind })
    })

    it.each([
        '/split',
        '/split/anything',
        '/en/split',
        '/en/split/unknown',
        '/en/split/a2-transport/',
        '/pt-br/split/a2-transport',
        '/split-static',
        '/split-sitemap.xml/extra',
    ])('firewalls the unowned Split namespace path %s', (pathname) => {
        expect(classifySplitA2Request(pathname, null)).toEqual({ action: 'not-found' })
    })

    it.each(['/splitter', '/en/splitter/page', '/foo/split-static/file.js', '/split-sitemap.xmlx'])(
        'passes unrelated path %s',
        (pathname) => {
            expect(classifySplitA2Request(pathname, null)).toEqual({ action: 'pass' })
        }
    )

    it('exposes the same namespace matcher for service-worker isolation', () => {
        expect(isSplitContentPathname('/en/split/a2-transport')).toBe(true)
        expect(isSplitContentPathname('/split-static/_next/a.js')).toBe(true)
        expect(isSplitContentPathname('/split-sitemap.xml')).toBe(true)
        expect(isSplitContentPathname('/_split-a2/headers')).toBe(true)
        expect(isSplitContentPathname('/_split-a2/set-cookie')).toBe(true)
        expect(isSplitContentPathname('/home')).toBe(false)
    })
})

describe('Split A2 edge configuration', () => {
    it('requires an explicit non-production canary switch', () => {
        expect(isSplitA2CanaryEnabled('1', 'preview')).toBe(true)
        expect(isSplitA2CanaryEnabled('1', 'production')).toBe(false)
        expect(isSplitA2CanaryEnabled(undefined, 'preview')).toBe(false)
    })

    it('accepts only an HTTP origin with no path, credentials, query, or fragment', () => {
        expect(splitContentOrigin('https://split.example/')).toEqual(new URL('https://split.example/'))
        expect(splitContentOrigin('http://localhost:8765')).toEqual(new URL('http://localhost:8765'))
        expect(splitContentOrigin('http://split.example/')).toBeNull()
        expect(splitContentOrigin('ftp://split.example/')).toBeNull()
        expect(splitContentOrigin('https://user:pass@split.example/')).toBeNull()
        expect(splitContentOrigin('https://split.example/base')).toBeNull()
        expect(splitContentOrigin('https://split.example/?token=x')).toBeNull()
        expect(splitContentOrigin(undefined)).toBeNull()
    })
})
