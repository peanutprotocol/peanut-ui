// Client capture must never turn a username, payment ID or arbitrary 404 into
// a stored attribution path. Derive the allowlist from the sitemap that ships
// with this build, rather than maintaining another set of content routes.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import generateSitemap from '../src/app/sitemap'
import { SUPPORTED_LOCALES } from '../src/i18n/types'
import { isGoneMarketingPath } from '../src/constants/gone-routes.consts'

async function main() {
    if (!existsSync(resolve('src/content/content'))) {
        throw new Error('Initialize the src/content submodule before generating attribution paths')
    }
    const sitemapPaths = (await generateSitemap()).map(({ url }) => new URL(url).pathname)
    // Routes also serve prose through the locale fallback chain. Those real
    // landing URLs are absent from the sitemap, which lists canonical owners.
    const paths = [
        ...new Set(
            sitemapPaths.flatMap((pathname) => {
                const [, locale, ...rest] = pathname.split('/')
                if (!SUPPORTED_LOCALES.some((supported) => supported === locale) || rest.length === 0) return [pathname]
                return SUPPORTED_LOCALES.map((supported) => `/${supported}/${rest.join('/')}`).filter(
                    (path) => !isGoneMarketingPath(path)
                )
            })
        ),
    ].sort()
    if (!paths.includes('/en/blog') || paths.length < 2) {
        throw new Error('Sitemap has no content hub; refusing to replace the attribution inventory')
    }
    const output = `${JSON.stringify(paths, null, 4)}\n`
    const outputFile = resolve('src/constants/signup-attribution-paths.generated.json')
    if (process.argv.includes('--check')) {
        if (!existsSync(outputFile) || readFileSync(outputFile, 'utf8') !== output) {
            throw new Error('Attribution paths are stale. Run pnpm generate:signup-attribution-paths')
        }
        console.log(`[signup-attribution] checked ${paths.length} public paths`)
        return
    }
    writeFileSync(outputFile, output)
    console.log(`[signup-attribution] wrote ${paths.length} public paths`)
}

main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
})
