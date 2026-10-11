/** @jest-environment jsdom */
/**
 * On a localized marketing page the route provider must win over the outer
 * IntlCore — on the first render (what SSR and hydration see) and after the
 * outer instance swaps to the device locale.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useTranslations } from 'next-intl'
import { IntlCore } from '../IntlCore'
import { RouteIntlProvider } from '../RouteIntlProvider'
import en from '../messages/en.json'

// the browser server build needs MessageChannel, which jsdom lacks
jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))

jest.mock('../locale-store', () => ({
    currentAppLocale: () => null,
    emitDeviceContextToAnalytics: jest.fn(() => Promise.resolve()),
    emitLocaleToAnalytics: jest.fn(),
    // the device asks for Spanish; the page URL is Portuguese
    localeReady: () => Promise.resolve('es-419'),
    markLocaleApplied: jest.fn(),
    persistLocale: jest.fn(),
}))
jest.mock('../../htmlLangClaim', () => ({
    isHtmlLangClaimed: () => false,
    setHtmlLangReleaseListener: jest.fn(),
}))

function Probe({ id }: { id: string }) {
    const t = useTranslations('common')
    return <span data-testid={id}>{t('cancel')}</span>
}

const spanishCatalog = { ...en, common: { ...en.common, cancel: 'Cancelar' } }
const portugueseCatalog = { ...en, common: { ...en.common, cancel: 'Cancelar (pt)' } }

function Tree({ load }: { load: () => Promise<typeof en> }) {
    return (
        <IntlCore base={en} load={load}>
            <Probe id="outside" />
            <RouteIntlProvider locale="pt-BR" messages={portugueseCatalog}>
                <Probe id="page" />
            </RouteIntlProvider>
        </IntlCore>
    )
}

describe('RouteIntlProvider', () => {
    it('renders the URL locale in server HTML', () => {
        const html = renderToString(<Tree load={() => Promise.resolve(spanishCatalog)} />)
        expect(html).toContain('Cancelar (pt)')
    })

    it('keeps the URL locale on first render and after the device-locale swap', async () => {
        const load = jest.fn(() => Promise.resolve(spanishCatalog))
        render(<Tree load={load} />)
        expect(screen.getByTestId('page')).toHaveTextContent('Cancelar (pt)')
        expect(screen.getByTestId('outside')).toHaveTextContent('Cancel')

        // the outer instance still resolves and applies the device locale…
        await waitFor(() => expect(screen.getByTestId('outside')).toHaveTextContent('Cancelar'))
        expect(load).toHaveBeenCalledWith('es-419')
        // …but it never reaches the page subtree
        expect(screen.getByTestId('page')).toHaveTextContent('Cancelar (pt)')
    })

    it('falls back to the bundled English catalog when no messages are sent', () => {
        render(
            <RouteIntlProvider locale="en">
                <Probe id="page" />
            </RouteIntlProvider>
        )
        expect(screen.getByTestId('page')).toHaveTextContent(en.common.cancel)
    })
})
