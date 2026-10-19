import test from 'node:test'
import assert from 'node:assert/strict'
import { marketingOnly, planCapture } from './capture-plan.mjs'
import { trustedCatalogue } from './capture-impact.mjs'
import { CAPTURE_LOCALES } from './capture-locales.mjs'
import { marketingFlow, marketingPaths, marketingScreenId, sliceOffsets } from './capture-marketing.mjs'

const marketingRoute = (route) => {
    const segments = new URL(route, 'https://screen-library.invalid').pathname.split('/').filter(Boolean)
    return !segments.length || CAPTURE_LOCALES.map((locale) => locale.toLowerCase()).includes(segments[0].toLowerCase())
}

test('sitemap pages, not catalogue states, cover the marketing site', () => {
    assert.deepEqual(
        trustedCatalogue.filter((screen) => marketingRoute(screen.route)).map((screen) => screen.id),
        []
    )
    assert.deepEqual(
        trustedCatalogue.filter((screen) => /SetupDoc/.test(screen.source ?? '')).map((screen) => screen.id),
        []
    )
})

const screens = [{ id: 'home', flow: 'Home', sources: ['src/features/home/Home.tsx'] }]
const plan = (changedFiles) =>
    planCapture({
        event: 'pull_request',
        branch: 'dev',
        changedFiles,
        screens,
        dependencies: { 'src/features/home/Home.tsx': [] },
    }).mode

test('marketing and content-only changes capture everything, since sitemap pages need a full run', () => {
    for (const path of [
        'src/content',
        'src/app/[locale]/(marketing)/help/page.tsx',
        'src/app/es-ar/page.tsx',
        'src/app/page.tsx',
        'src/app/api/og/marketing/route.tsx',
        'src/components/Marketing/mdx/FAQ.tsx',
        'src/i18n/es-ar.json',
        'src/i18n/pt-br.json',
        'src/i18n/app/messages/pt-BR.marketing.json',
        'src/i18n/app/MarketingIntlProvider.tsx',
    ]) {
        assert.equal(marketingOnly(path), true, path)
        assert.equal(plan([path]), 'full', path)
    }
    assert.equal(plan(['src/content', 'src/features/home/Home.tsx']), 'full')
})

const sitemap = (locs) =>
    `<?xml version="1.0"?><urlset>${locs.map((loc) => `<url><loc>${loc}</loc></url>`).join('')}</urlset>`

test('sitemap pages are split by capture locale', () => {
    const xml = sitemap([
        'https://staging.peanut.me',
        'https://staging.peanut.me/careers',
        'https://staging.peanut.me/shhhhh',
        'https://staging.peanut.me/en/privacy',
        'https://staging.peanut.me/en/send-money-to/kenya/',
        'https://staging.peanut.me/en/send-money-to/kenya',
        'https://staging.peanut.me/es-419',
        'https://staging.peanut.me/es-419/argentina',
        'https://staging.peanut.me/es-ar/argentina',
        'https://staging.peanut.me/pt-br/help?x=1&amp;y=2',
        'not a url',
    ])
    for (const [locale, expected] of [
        ['en', ['/', '/careers', '/en/privacy', '/en/send-money-to/kenya', '/shhhhh']],
        ['es-419', ['/es-419', '/es-419/argentina']],
        ['es-AR', ['/es-ar/argentina']],
        ['pt-BR', ['/pt-br/help']],
    ])
        assert.deepEqual(marketingPaths(xml, locale), expected, locale)
    assert.deepEqual(marketingPaths(sitemap([]), 'en'), [])
    assert.throws(() => marketingPaths(xml, 'fr'), /Unsupported/)
})

test('slice IDs are valid, stable and unique per page and slice', () => {
    const valid = /^[a-z0-9][a-z0-9-]{0,119}$/
    const long = `/en/help/${'very-long-article-slug-'.repeat(8)}`
    for (const [path, slice, expected] of [
        ['/', 1, 'mkt-root-1'],
        ['/es-419', 2, 'mkt-es-419-2'],
        ['/en/send-money-from/argentina/to/brazil', 3, 'mkt-en-send-money-from-argentina-to-brazil-3'],
    ])
        assert.equal(marketingScreenId(path, slice), expected)
    const id = marketingScreenId(long, 24)
    assert.match(id, valid)
    assert.equal(id, marketingScreenId(long, 24))
    assert.notEqual(marketingScreenId(long, 24), marketingScreenId(`${long}x`, 24))
})

test('slices cover the page, end on its real bottom and stop at the cap', () => {
    for (const [height, expected] of [
        [500, [0]],
        [852, [0]],
        [853, [0, 1]],
        [1704, [0, 852]],
        [2000, [0, 852, 1148]],
    ])
        assert.deepEqual(sliceOffsets(height, 852).offsets, expected, String(height))
    const capped = sliceOffsets(852 * 40, 852, 24)
    assert.equal(capped.offsets.length, 24)
    assert.equal(capped.truncated, true)
    assert.equal(capped.offsets.at(-1), 852 * 39)
    assert.equal(sliceOffsets(852 * 24, 852, 24).truncated, false)
    for (const bad of [0, -1, Number.NaN]) assert.throws(() => sliceOffsets(bad, 852), /geometry/)
})

test('pages group into readable marketing flows', () => {
    for (const [path, flow] of [
        ['/', 'Marketing · Landing'],
        ['/es-419', 'Marketing · Landing'],
        ['/en/argentina', 'Marketing · Countries'],
        ['/careers', 'Marketing · Company and legal'],
        ['/en/card-terms-us', 'Marketing · Company and legal'],
        ['/en/help', 'Marketing · Help'],
        ['/pt-br/send-money-to/kenya', 'Marketing · Send money to'],
    ])
        assert.equal(marketingFlow(path), flow, path)
})
