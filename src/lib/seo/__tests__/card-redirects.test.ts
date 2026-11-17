import redirects from '../../../../redirects.json'
import { resolvePermanentRedirectPath } from '../redirects'

// Next's own matcher for `source` patterns; the compiled copy ships without types.
const { match } = require('next/dist/compiled/path-to-regexp') as {
    match: (pattern: string, options?: { decode?: (value: string) => string }) => (path: string) => unknown
}

type Redirect = { source: string; destination: string; permanent: boolean; has?: unknown; missing?: unknown }
const table = redirects as Redirect[]

/** First unconditional rule Next would apply to this path, as Next evaluates them in order. */
function firstRedirect(pathname: string): Redirect | undefined {
    return table.find((r) => !r.has && !r.missing && match(r.source, { decode: decodeURIComponent })(pathname))
}

// /shhhhh was the card landing page until TASK-24171; its aliases must reach /peanut-card in one hop.
const LEGACY_CARD_PATHS = ['/shhhhh', '/shhhhh/', '/shhhhh/anything', '/sh', '/sh/', '/sh/abc', '/lp/card']

describe('legacy card URLs', () => {
    it.each(LEGACY_CARD_PATHS)('%s redirects permanently to /peanut-card', (path) => {
        const rule = firstRedirect(path)
        expect(rule).toMatchObject({ destination: '/peanut-card', permanent: true })
    })

    it('lands on a page that does not redirect again', () => {
        expect(firstRedirect('/peanut-card')).toBeUndefined()
        expect(firstRedirect('/peanut-card/')).toBeUndefined()
    })

    it('resolves exact aliases for content links and the sitemap filter', () => {
        expect(resolvePermanentRedirectPath('/shhhhh')).toBe('/peanut-card')
        expect(resolvePermanentRedirectPath('/sh')).toBe('/peanut-card')
        expect(resolvePermanentRedirectPath('/lp/card')).toBe('/peanut-card')
    })

    it('sends the retired physical-card list screen to the card, not permanently', () => {
        expect(firstRedirect('/card/physical')).toMatchObject({ destination: '/card', permanent: false })
    })
})

describe('redirect table', () => {
    it('has no chains or loops between static rules', () => {
        const chained = table
            .filter((r) => !r.has && !r.missing && !r.destination.includes(':') && !r.destination.includes('?'))
            .filter((r) => firstRedirect(r.destination))
            .map((r) => `${r.source} -> ${r.destination} -> ${firstRedirect(r.destination)!.destination}`)
        expect(chained).toEqual([])
    })
})
