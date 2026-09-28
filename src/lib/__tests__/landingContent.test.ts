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
    it.each(SUPPORTED_LOCALES)('%s has the same number of chips as en, so ids pair by position', (locale) => {
        const enIds = getLandingContent('en').marqueeMessages.map((chip) => chip.id)
        expect(getLandingContent(locale).marqueeMessages.map((chip) => chip.id)).toEqual(enIds)
    })

    // words like 24/7, USD and GLOBAL are spelled the same in every locale, so a
    // reordered list would pair them with a neighbour's id
    it.each(SUPPORTED_LOCALES.filter((locale) => locale !== 'en'))('%s lists the marquee in en order', (locale) => {
        const enWords = new Set(getLandingContent('en').marqueeMessages.map((chip) => chip.label))
        const shared = getLandingContent(locale).marqueeMessages.filter((chip) => enWords.has(chip.label))
        expect(shared.length).toBeGreaterThan(0)
        for (const chip of shared) expect(chip.id).toBe(chip.label)
    })

    it('keeps the translated label', () => {
        expect(getLandingContent('pt-br').marqueeMessages[0]).toEqual({
            id: 'No transfer fees',
            label: 'Sem taxas de envio',
        })
    })
})
