/**
 * The server half picks the catalog from the URL segment, including the es-ar
 * overlay on es-419, so the prerendered HTML is already translated.
 */
import { isValidElement } from 'react'
import { RouteIntl } from '../RouteIntl'
import en from '@/i18n/app/messages/en.marketing.json'
import es419 from '@/i18n/app/messages/es-419.marketing.json'
import esAR from '@/i18n/app/messages/es-AR.marketing.json'
import ptBR from '@/i18n/app/messages/pt-BR.marketing.json'

type Props = { locale: string; messages: { shhhhh: { hero: { tagline: string } } } }

async function propsFor(locale: Parameters<typeof RouteIntl>[0]['locale']): Promise<Props> {
    const element = await RouteIntl({ locale, children: null })
    if (!isValidElement<Props>(element)) throw new Error('RouteIntl must render an element')
    return element.props
}

describe('RouteIntl', () => {
    it.each([
        ['pt-br', 'pt-BR', ptBR.shhhhh.hero.tagline],
        ['es-419', 'es-419', es419.shhhhh.hero.tagline],
        ['es-ar', 'es-AR', esAR.shhhhh.hero.tagline],
        ['en', 'en', en.shhhhh.hero.tagline],
    ])('%s renders %s copy', async (segment, appLocale, tagline) => {
        const props = await propsFor(segment as 'en')
        expect(props.locale).toBe(appLocale)
        expect(props.messages.shhhhh.hero.tagline).toBe(tagline)
    })

    it('es-ar is an overlay: keys it does not override come from es-419', async () => {
        const props = await propsFor('es-ar')
        expect((props.messages.shhhhh.hero as Record<string, string>).wordmark).toBe(es419.shhhhh.hero.wordmark)
    })

    it('localized taglines are actually translated', () => {
        expect(new Set([en, es419, esAR, ptBR].map((c) => c.shhhhh.hero.tagline)).size).toBe(4)
    })
})
