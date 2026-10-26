import React from 'react'
import { act } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { useLocale } from 'next-intl'
import { IntlCore } from '@/i18n/app/IntlCore'
import { RouteIntlProvider } from '@/i18n/app/RouteIntlProvider'
import { useReceiptDateFormatter } from '@/components/TransactionDetails/useReceiptDateFormatter'
import en from '../messages/en.json'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
jest.mock('../locale-store', () => ({
    currentAppLocale: () => null,
    emitDeviceContextToAnalytics: jest.fn(async () => {}),
    emitLocaleToAnalytics: jest.fn(),
    localeReady: () => Promise.resolve('en'),
    markLocaleApplied: jest.fn(),
    persistLocale: jest.fn(),
}))
jest.mock('../../htmlLangClaim', () => ({
    isHtmlLangClaimed: () => false,
    setHtmlLangReleaseListener: jest.fn(),
}))

const timestamp = new Date('2026-01-02T01:04:00.000Z')
const RealDateTimeFormat = Intl.DateTimeFormat
const viewerZone = 'America/Argentina/Buenos_Aires'

function Receipt({ date }: { date?: Date }) {
    const format = useReceiptDateFormatter()
    const locale = useLocale()
    return (
        <div data-testid="receipt" lang={locale}>
            {format(date)}
        </div>
    )
}

function Tree({ routeLocale, date }: { routeLocale?: 'en' | 'es-419'; date?: Date }) {
    return (
        <IntlCore base={en} load={async () => en}>
            {routeLocale ? (
                <RouteIntlProvider locale={routeLocale} messages={en}>
                    <Receipt date={date} />
                </RouteIntlProvider>
            ) : (
                <Receipt date={date} />
            )}
        </IntlCore>
    )
}

function expectedReceipt(locale: string, timeZone: string) {
    const date = new RealDateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone }).format(
        timestamp
    )
    const time = new RealDateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(
        timestamp
    )
    return `${date} ${time}`
}

describe('receipt timezone hydration', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let defaultZone: string

    beforeEach(() => {
        defaultZone = 'UTC'
        const dateTimeFormat = jest
            .spyOn(Intl, 'DateTimeFormat')
            .mockImplementation(
                (locales, options) =>
                    new RealDateTimeFormat(locales, { ...options, timeZone: options?.timeZone ?? defaultZone })
            )
        Object.assign(dateTimeFormat, { supportedLocalesOf: RealDateTimeFormat.supportedLocalesOf })
        jest.spyOn(navigator, 'language', 'get').mockReturnValue('es-AR')
        jest.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-AR', 'es'])
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        jest.restoreAllMocks()
    })

    it.each([undefined, 'en', 'es-419'] as const)(
        'hydrates UTC receipts and switches to the viewer timezone with route locale %s',
        async (routeLocale) => {
            const locale = routeLocale ?? 'en'
            for (let cycle = 0; cycle < 2; cycle++) {
                defaultZone = 'UTC'
                container.innerHTML = renderToString(<Tree routeLocale={routeLocale} date={timestamp} />)
                const receipt = container.querySelector('[data-testid="receipt"]')!
                expect(receipt).toHaveTextContent(expectedReceipt(locale, 'UTC'))
                defaultZone = viewerZone
                expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
                    new RealDateTimeFormat('en', { timeZone: viewerZone }).resolvedOptions().timeZone
                )
                const onRecoverableError = jest.fn()
                await act(async () => {
                    root = hydrateRoot(container, <Tree routeLocale={routeLocale} date={timestamp} />, {
                        onRecoverableError,
                    })
                })

                expect(onRecoverableError).not.toHaveBeenCalled()
                expect(container.querySelector('[data-testid="receipt"]')).toBe(receipt)
                expect(receipt).toHaveAttribute('lang', locale)
                expect(receipt).toHaveTextContent(expectedReceipt(locale, viewerZone))
                act(() => root!.unmount())
                root = undefined
            }
        }
    )

    it.each([undefined, new Date('invalid')])('keeps the dash fallback for unavailable date %s', async (date) => {
        container.innerHTML = renderToString(<Tree date={date} />)
        const receipt = container.querySelector('[data-testid="receipt"]')!
        expect(receipt).toHaveTextContent('—')
        defaultZone = viewerZone
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Tree date={date} />, { onRecoverableError })
        })
        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(container.querySelector('[data-testid="receipt"]')).toBe(receipt)
        expect(receipt).toHaveTextContent('—')
    })
})
