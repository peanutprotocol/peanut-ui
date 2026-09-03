/** @jest-environment jsdom */
/**
 * `localeApplied()` is one-shot and the native splash waits on it. Only the
 * instance that gates the splash (AppIntlProvider) may resolve it: the
 * marketing instance mounts first on native (`/` is a marketing route) and
 * used to release the splash while the app catalog was still loading.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useTranslations } from 'next-intl'
import { IntlCore } from '../IntlCore'
import en from '../messages/en.json'

let mockResolvedLocale = 'es-419'
const mockMarkLocaleApplied = jest.fn()
jest.mock('../locale-store', () => ({
    currentAppLocale: () => null,
    emitDeviceContextToAnalytics: jest.fn(() => Promise.resolve()),
    emitLocaleToAnalytics: jest.fn(),
    localeReady: () => Promise.resolve(mockResolvedLocale),
    markLocaleApplied: () => mockMarkLocaleApplied(),
    persistLocale: jest.fn(),
}))
jest.mock('../../htmlLangClaim', () => ({
    isHtmlLangClaimed: () => false,
    setHtmlLangReleaseListener: jest.fn(),
}))

function Probe() {
    const t = useTranslations('common')
    return <span data-testid="probe">{t('cancel')}</span>
}

const spanishCatalog = { ...en, common: { ...en.common, cancel: 'Cancelar' } }

describe('IntlCore splash gating', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockResolvedLocale = 'es-419'
        jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        ;(console.error as jest.Mock).mockRestore()
    })

    it('the marketing instance swaps its catalog but never marks the locale applied', async () => {
        const load = jest.fn(() => Promise.resolve(spanishCatalog))
        render(
            <IntlCore base={en} load={load}>
                <Probe />
            </IntlCore>
        )
        await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('Cancelar'))
        expect(load).toHaveBeenCalledWith('es-419')
        expect(mockMarkLocaleApplied).not.toHaveBeenCalled()
    })

    it('the app instance marks applied once the startup catalog is painted', async () => {
        const load = jest.fn(() => Promise.resolve(spanishCatalog))
        render(
            <IntlCore base={en} load={load} gatesSplash>
                <Probe />
            </IntlCore>
        )
        expect(mockMarkLocaleApplied).not.toHaveBeenCalled()
        await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('Cancelar'))
        expect(mockMarkLocaleApplied).toHaveBeenCalledTimes(1)
    })

    it('the app instance marks applied straight away when the startup locale is English', async () => {
        mockResolvedLocale = 'en'
        const load = jest.fn(() => Promise.resolve(spanishCatalog))
        render(
            <IntlCore base={en} load={load} gatesSplash>
                <Probe />
            </IntlCore>
        )
        await waitFor(() => expect(mockMarkLocaleApplied).toHaveBeenCalledTimes(1))
        expect(load).not.toHaveBeenCalled()
    })

    it('a failed catalog load still marks applied (the splash never waits on it) and keeps English', async () => {
        const load = jest.fn(() => Promise.reject(new Error('chunk failed')))
        render(
            <IntlCore base={en} load={load} gatesSplash>
                <Probe />
            </IntlCore>
        )
        await waitFor(() => expect(mockMarkLocaleApplied).toHaveBeenCalledTimes(1))
        expect(screen.getByTestId('probe')).toHaveTextContent('Cancel')
        expect(console.error).toHaveBeenCalledWith('Startup catalog failed to load', expect.any(Error))
    })

    it('a failed load on the marketing instance is logged but does not touch the gate', async () => {
        const load = jest.fn(() => Promise.reject(new Error('chunk failed')))
        render(
            <IntlCore base={en} load={load}>
                <Probe />
            </IntlCore>
        )
        await waitFor(() => expect(console.error).toHaveBeenCalled())
        expect(mockMarkLocaleApplied).not.toHaveBeenCalled()
    })
})
