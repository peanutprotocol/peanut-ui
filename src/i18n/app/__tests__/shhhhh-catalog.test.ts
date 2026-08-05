import { APP_LOCALES } from '../config'
import { loadMessages } from '../messages'
import esAR from '../messages/es-AR.json'

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

    it('the es-AR delta stays a delta rather than a full copy', () => {
        // A full duplicate would silently stop inheriting es-419 fixes.
        expect(Object.keys(esAR.shhhhh).length).toBeLessThan(8)
    })
})
