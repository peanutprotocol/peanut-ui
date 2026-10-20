/** @jest-environment node */
import { STAR_LP_ROUTES } from '@/components/Marketing/StarLp/starLp.consts'
import { starLpMetadata } from '@/components/Marketing/StarLp/starLpMetadata'

describe('starLpMetadata', () => {
    it.each(Object.values(STAR_LP_ROUTES))('keeps %s noindex/nofollow with its own OG card', (path) => {
        const meta = starLpMetadata({ title: 'T', description: 'D', path, ogSubtitle: 'S' })
        expect(meta.robots).toEqual({ index: false, follow: false })
        expect(meta.alternates?.canonical).toBe(path)
        expect(JSON.stringify(meta.openGraph?.images)).toContain('/api/og/marketing?title=T&subtitle=S')
    })
})

describe('starLpMetadata OG headline', () => {
    it('drops the brand suffix from the card headline but keeps it in <title>', () => {
        const meta = starLpMetadata({ title: 'Peanut Card | Peanut', description: 'D', path: '/peanut-card' })
        expect(meta.title).toBe('Peanut Card | Peanut')
        expect(JSON.stringify(meta.openGraph?.images)).toContain('/api/og/marketing?title=Peanut%20Card"')
    })

    it('uses ogTitle as the card headline when given', () => {
        const meta = starLpMetadata({ title: 'T | Peanut', description: 'D', path: '/x', ogTitle: 'Send this.' })
        expect(JSON.stringify(meta.openGraph?.images)).toContain('title=Send%20this.')
    })
})
