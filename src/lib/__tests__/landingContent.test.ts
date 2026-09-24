import { getLandingContent } from '../landingContent'
import { SUPPORTED_LOCALES } from '@/i18n/types'

describe('landing marquee chips', () => {
    it('uses the English word as the id on en', () => {
        const chips = getLandingContent('en').marqueeMessages
        expect(chips.length).toBeGreaterThan(0)
        for (const chip of chips) expect(chip.id).toBe(chip.label)
    })

    // LandingPageClient keys the chip links by id, so a translated chip needs
    // the English id or it renders without its link
    it.each(SUPPORTED_LOCALES)('%s chips carry the English ids in en order', (locale) => {
        const enIds = getLandingContent('en').marqueeMessages.map((chip) => chip.id)
        expect(getLandingContent(locale).marqueeMessages.map((chip) => chip.id)).toEqual(enIds)
    })

    it('keeps the translated label', () => {
        expect(getLandingContent('pt-br').marqueeMessages[0]).toEqual({
            id: 'No transfer fees',
            label: 'Sem taxas de envio',
        })
    })
})
