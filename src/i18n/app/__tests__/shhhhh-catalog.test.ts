import { APP_LOCALES } from '../config'
import { loadMessages } from '../messages'
import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'

function leafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key
        return typeof value === 'object' && value !== null ? leafPaths(value as Record<string, unknown>, path) : [path]
    })
}

describe('/shhhhh catalog', () => {
    it.each(APP_LOCALES)('%s keeps the <counter> tag the hero interpolates', async (locale) => {
        const messages = await loadMessages(locale)
        // t.rich renders <ScarcityCounter/> into this tag; drop it in a translation
        // and the "only 20 a week" scarcity beat silently disappears.
        expect(messages.shhhhh.hero.body).toContain('<counter></counter>')
    })

    it('es-AR overlays voseo onto the es-419 copy', async () => {
        const [es419, esArResolved] = await Promise.all([loadMessages('es-419'), loadMessages('es-AR')])

        expect(es419.shhhhh.hero.tagline).toContain('Para ti')
        expect(esArResolved.shhhhh.hero.tagline).toContain('Para vos')
        // untouched keys still fall through to es-419
        expect(esArResolved.shhhhh.faq.q2.answer).toBe(es419.shhhhh.faq.q2.answer)
    })

    it('the es-AR delta stays a strict subset of es-419', () => {
        // A full duplicate would silently stop inheriting es-419 fixes. Compare
        // leaf paths rather than counting sections, so overriding one more
        // section is allowed but copying the whole namespace is not.
        const base = leafPaths(es419.shhhhh)
        const delta = leafPaths(esAR.shhhhh)

        expect(delta.filter((path) => !base.includes(path))).toEqual([])
        expect(delta.length).toBeLessThan(base.length)
    })
})
