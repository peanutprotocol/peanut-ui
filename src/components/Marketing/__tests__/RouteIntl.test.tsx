/** @jest-environment jsdom */
/**
 * The server half picks the catalog from the URL segment, including the es-ar
 * overlay on es-419, so the prerendered HTML is already translated. It sends
 * every marketing namespace except `errors`, and nothing for English.
 */
import { isValidElement } from 'react'
import { render, screen } from '@testing-library/react'
import { RouteIntl } from '../RouteIntl'
import { ShhhhhFold } from '@/components/LandingPage/ShhhhhFold'
import en from '@/i18n/app/messages/en.marketing.json'
import es419 from '@/i18n/app/messages/es-419.marketing.json'
import esAR from '@/i18n/app/messages/es-AR.marketing.json'
import ptBR from '@/i18n/app/messages/pt-BR.marketing.json'

jest.mock('next/dynamic', () => () => () => null)

type Messages = Record<string, Record<string, unknown>> & { shhhhh: { hero: { tagline: string } } }
type Props = { locale: string; messages?: Messages }

async function routeIntl(locale: Parameters<typeof RouteIntl>[0]['locale'], children: React.ReactNode = null) {
    const element = await RouteIntl({ locale, children })
    if (!isValidElement<Props>(element)) throw new Error('RouteIntl must render an element')
    return element
}

// every marketing namespace but `errors` (read only by AuthProvider, above the tree)
const NEEDED = Object.keys(en).filter((ns) => ns !== 'errors')

describe('RouteIntl', () => {
    it.each([
        ['pt-br', 'pt-BR', ptBR.shhhhh.hero.tagline],
        ['es-419', 'es-419', es419.shhhhh.hero.tagline],
        ['es-ar', 'es-AR', esAR.shhhhh.hero.tagline],
    ])('%s sends the %s catalog with every namespace but errors', async (segment, appLocale, tagline) => {
        const { props } = await routeIntl(segment as 'pt-br')
        expect(props.locale).toBe(appLocale)
        expect(props.messages?.shhhhh.hero.tagline).toBe(tagline)
        for (const ns of NEEDED) expect(Object.keys(props.messages?.[ns] ?? {}).length).toBeGreaterThan(0)
        // app-only weight stays out of the page payload
        expect(props.messages).not.toHaveProperty('errors')
    })

    it('es-ar is an overlay: keys it does not override come from es-419', async () => {
        const { props } = await routeIntl('es-ar')
        expect(props.messages?.shhhhh.hero).toHaveProperty('wordmark', es419.shhhhh.hero.wordmark)
    })

    it('sends no catalog for English (the client already has marketingBase)', async () => {
        const { props } = await routeIntl('en')
        expect(props.locale).toBe('en')
        expect(props.messages).toBeUndefined()
    })

    it.each([
        ['pt-br', ptBR.shhhhh.hero.tagline],
        ['en', 'Your money. Ready to spend.'],
    ])('the card fold renders %s copy with no missing keys', async (segment, tagline) => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
        render(await routeIntl(segment as 'en', <ShhhhhFold />))
        expect(screen.getByText(tagline)).toBeInTheDocument()
        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
    })
})
