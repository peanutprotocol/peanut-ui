import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { marketingOnly, planCapture } from './capture-plan.mjs'
import { revisionGraph, trustedCatalogue } from './capture-impact.mjs'
import { CAPTURE_LOCALES } from './capture-locales.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const runGit = (args, input) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', input, maxBuffer: 256 * 1024 * 1024 })

// Static imports that never render in a captured state. Each must stay a real edge, or it is removed here.
const runtimeGated = new Map([
    // ClientProviders mounts the marketing catalogue only when isMarketingRoute() is true.
    ['src/app/ClientProviders.tsx', ['src/i18n/app/MarketingIntlProvider.tsx']],
    // Builds the setup docs drawer's article content; no captured state opens that drawer.
    [
        'src/components/Setup/components/setupDocuments.server.tsx',
        ['src/components/Setup/components/SetupDocMdx.tsx', 'src/lib/mdx.ts'],
    ],
])
const marketingRoute = (route) => {
    const segments = new URL(route, 'https://screen-library.invalid').pathname.split('/').filter(Boolean)
    return !segments.length || CAPTURE_LOCALES.map((locale) => locale.toLowerCase()).includes(segments[0].toLowerCase())
}

function capturedClosure() {
    const { screens, dependencies } = revisionGraph('HEAD', trustedCatalogue, runGit, Date.now() + 120000)
    const reached = new Set()
    const pending = screens.flatMap((screen) => screen.sources)
    while (pending.length) {
        const path = pending.pop()
        if (reached.has(path)) continue
        reached.add(path)
        const gated = runtimeGated.get(path) ?? []
        pending.push(...(dependencies[path] ?? []).filter((dependency) => !gated.includes(dependency)))
    }
    return { reached, dependencies }
}

test('no captured screen can render a marketing or content path', () => {
    const { reached, dependencies } = capturedClosure()
    assert.ok(reached.size > 500, `closure looks truncated: ${reached.size} files`)
    for (const [from, edges] of runtimeGated)
        for (const to of edges) assert.ok(dependencies[from]?.includes(to), `stale runtime-gated edge ${from} -> ${to}`)
    const leaked = [...reached].filter(marketingOnly)
    assert.deepEqual(
        leaked,
        [],
        'captured screens reach marketing-only paths; narrow marketingOnly in capture-plan.mjs'
    )
})

test('the runtime gates hold for the catalogue', () => {
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

test('marketing and content-only changes skip capture; app changes beside them still capture', () => {
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
    ])
        assert.equal(plan([path]), 'skip', path)
    assert.equal(plan(['src/content', 'src/features/home/Home.tsx']), 'full')
    for (const path of [
        'src/components/LandingPage/CurrencySelect.tsx',
        'src/i18n/app/messages/pt-BR.json',
        'src/app/(mobile-ui)/home/page.tsx',
        'src/lib/mdx.ts',
    ])
        assert.notEqual(plan([path]), 'skip', path)
})
