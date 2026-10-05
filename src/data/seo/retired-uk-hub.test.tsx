/** @jest-environment node */
import fs from 'fs'
import os from 'os'
import path from 'path'

// The UK country hub (content/countries/united-kingdom) is deleted from the
// content tree, because its body addresses UK residents. Pages for non-UK users
// about UK rails must outlive it: send-money-to and receive-money-from used to
// take their country list, flag and localized name from the hub.
//
// This runs the real loaders against a copy of the content tree with the hub
// removed. lib/content reads `process.cwd()/src/content` at module load.

let fixtureRoot: string

beforeAll(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retired-uk-hub-'))
    const source = path.join(process.cwd(), 'src/content/content')
    const target = path.join(fixtureRoot, 'src/content/content')
    for (const intent of ['countries', 'send-to', 'receive-from']) {
        fs.cpSync(path.join(source, intent), path.join(target, intent), { recursive: true })
    }
    fs.rmSync(path.join(target, 'countries/united-kingdom'), { recursive: true })
})

afterAll(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

function loadWithoutUkHub() {
    const cwd = jest.spyOn(process, 'cwd').mockReturnValue(fixtureRoot)
    try {
        let modules!: {
            seo: typeof import('./corridors')
            grid: typeof import('@/components/Marketing/DestinationGrid')
            sitemap: typeof import('@/app/sitemap')
            // Rendered with the isolated registry's own React copy.
            server: typeof import('react-dom/server')
        }
        jest.isolateModules(() => {
            modules = {
                seo: require('./corridors'),
                grid: require('@/components/Marketing/DestinationGrid'),
                sitemap: require('@/app/sitemap'),
                server: require('react-dom/server'),
            }
        })
        return modules
    } finally {
        cwd.mockRestore()
    }
}

describe('with the UK country hub deleted', () => {
    it('has no UK hub but keeps the UK send-to destination', () => {
        const { seo } = loadWithoutUkHub()

        expect(seo.COUNTRIES_SEO['united-kingdom']).toBeUndefined()
        expect(seo.SEND_TO_COUNTRIES).toContain('united-kingdom')
        expect(seo.RECEIVE_SOURCES).toContain('united-kingdom')
    })

    it('still resolves the UK flag code from the country catalog', () => {
        const { seo } = loadWithoutUkHub()

        expect(seo.countryIso2('united-kingdom')).toBe('gb')
        // A country with a hub keeps the hub's code.
        expect(seo.countryIso2('brazil')).toBe('br')
    })

    it.each([
        ['en', 'United Kingdom'],
        ['es-419', 'Reino Unido'],
        ['es-ar', 'Reino Unido'],
        ['pt-br', 'Reino Unido'],
    ] as const)('names the UK in %s as %s', (locale, name) => {
        const { seo } = loadWithoutUkHub()

        expect(seo.getCountryName('united-kingdom', locale)).toBe(name)
    })

    it('keeps send-to-UK and receive-from-UK in the sitemap, without the hub', async () => {
        const { sitemap } = loadWithoutUkHub()
        const paths = (await sitemap.default()).map((entry) => new URL(entry.url).pathname)

        for (const locale of ['en', 'es-419', 'pt-br']) {
            expect(paths).toContain(`/${locale}/send-money-to/united-kingdom`)
            expect(paths).toContain(`/${locale}/receive-money-from/united-kingdom`)
            expect(paths).not.toContain(`/${locale}/united-kingdom`)
        }
    })

    it('keeps the UK card, flag and localized name in the destination grid', () => {
        const { grid, server } = loadWithoutUkHub()
        const html = server.renderToStaticMarkup(<grid.DestinationGrid locale="es-419" title="Destinos" />)
        const ukCard = html.match(/<a [^>]*href="[^"]*\/send-money-to\/united-kingdom"[^>]*>(.*?)<\/a>/)?.[1]

        expect(ukCard).toBeDefined()
        expect(ukCard).toContain('Reino Unido</span>')
        expect(ukCard).toContain('alt="Reino Unido flag"')
    })
})
