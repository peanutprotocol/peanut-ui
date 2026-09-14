import { APP_LOCALES } from '../config'
import { loadMessages } from '../messages'
import es419 from '../messages/es-419.json'
import esAR from '../messages/es-AR.json'
import { leafPaths } from './catalog-helpers'

describe('/shhhhh catalog', () => {
    it.each(APP_LOCALES)('%s has a public card CTA without admission copy', async (locale) => {
        const messages = await loadMessages(locale)
        const copy = JSON.stringify(messages.shhhhh)
        expect(messages.shhhhh.hero.cta).toBeTruthy()
        expect(copy).not.toMatch(/beta|waitlist|lista de espera|fila de espera|<counter>/i)
    })

    it('es-AR overlays voseo onto the es-419 copy', async () => {
        const [es419, esArResolved] = await Promise.all([loadMessages('es-419'), loadMessages('es-AR')])

        expect(es419.shhhhh.hero.cta).toBe('Consigue tu tarjeta')
        expect(esArResolved.shhhhh.hero.cta).toBe('Conseguí tu tarjeta')
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
