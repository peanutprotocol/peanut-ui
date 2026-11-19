/**
 * Test harness for the redesigned sign-up screens (T1: 01 Landing, 02 Username, 03 Passkey, 04 Invite).
 *
 * Screens draw their footer through the shell, so a component test renders the screen inside SetupShell, as the
 * page does. Copy is read from the real catalogs by key; a test never hard-codes a string that a key holds.
 *
 * A suite that renders through the shell mocks the language switcher in its own file (jest hoists mocks per file):
 *   jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createTranslator, NextIntlClientProvider } from 'next-intl'
import { cloneElement, type ReactElement, type ReactNode } from 'react'
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import esAR from '@/i18n/app/messages/es-AR.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'
import { SetupShell } from '@/components/Setup/redesign/shell/SetupShell'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

export type TestLocale = 'en' | 'es-AR' | 'es-419' | 'pt-BR'
type Catalog = Record<string, unknown>

export const CATALOGS: Record<TestLocale, Catalog> = {
    en: en as Catalog,
    'es-AR': esAR as Catalog,
    'es-419': es419 as Catalog,
    'pt-BR': ptBR as Catalog,
}

/** The raw catalog value at a dotted key, or undefined. */
export function rawMessage(key: string, locale: TestLocale = 'en'): unknown {
    return key.split('.').reduce<unknown>((node, part) => {
        if (node && typeof node === 'object') return (node as Record<string, unknown>)[part]
        return undefined
    }, CATALOGS[locale])
}

/**
 * A catalog string as the person sees it: ICU placeholders filled, rich-text tags dropped (their text kept).
 * Throws when the key is missing, so a test that needs a key the builder has not added fails with its name.
 */
export function msg(key: string, values: Record<string, string | number> = {}, locale: TestLocale = 'en'): string {
    const raw = rawMessage(key, locale)
    if (typeof raw !== 'string') throw new Error(`catalog ${locale} has no string at "${key}"`)
    const t = createTranslator({ locale, messages: CATALOGS[locale] as never })
    const tags = Array.from(raw.matchAll(/<([a-zA-Z0-9]+)>/g)).map((match) => match[1])
    const markup = Object.fromEntries(tags.map((tag) => [tag, (chunks: string) => chunks]))
    return (t.markup as unknown as (key: string, values: Record<string, unknown>) => string)(key, {
        ...values,
        ...markup,
    })
}

/** Plain-text equality that ignores the difference between a no-break space and a space. */
export const loose = (text: string) => text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

/** A text matcher for `getByText` that matches an element whose own full text is the catalog string. */
export const textOf = (expected: string) => (_content: string, element: Element | null) => {
    if (!element) return false
    const own = loose(element.textContent ?? '')
    if (own !== loose(expected)) return false
    // the innermost element holding the whole string
    return Array.from(element.children).every((child) => loose(child.textContent ?? '') !== loose(expected))
}

export const IntlProvider = ({ locale = 'en', children }: { locale?: TestLocale; children: ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={CATALOGS[locale] as never} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)

export type ShellOptions = {
    locale?: TestLocale
    showBackButton?: boolean
    onBack?: () => void
    wrap?: (node: ReactElement) => ReactElement
}

/** A query client per render, as the app's PeanutProvider gives one; no retries, so a failed lookup settles at once. */
export const testQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

/** The screen as the page renders it: inside SetupShell (footer, top bar, screen id), with the real catalog. */
export function shellTree(
    screenId: ScreenId,
    screen: ReactElement,
    options: ShellOptions = {},
    queryClient: QueryClient = testQueryClient()
) {
    const inner = (
        <SetupShell screenId={screenId} showBackButton={options.showBackButton} onBack={options.onBack}>
            {screen}
        </SetupShell>
    )
    return (
        <QueryClientProvider client={queryClient}>
            <IntlProvider locale={options.locale}>{options.wrap ? options.wrap(inner) : inner}</IntlProvider>
        </QueryClientProvider>
    )
}

export function renderInShell(screenId: ScreenId, screen: ReactElement, options: ShellOptions = {}) {
    const queryClient = testQueryClient()
    const view = render(shellTree(screenId, screen, options, queryClient))
    return {
        ...view,
        /** A fresh element each time, so the screen re-renders and reads changed mock state. */
        rerenderInShell: (next: ReactElement = screen) =>
            view.rerender(shellTree(screenId, cloneElement(next), options, queryClient)),
    }
}

/** `data-setup-state` of the screen on show. */
export const setupState = (container: ParentNode = document) =>
    container.querySelector('[data-setup-stage]')?.getAttribute('data-setup-state') ?? null

/** Every sign-up CONTROL_USED captured, as `control:action[:value]`. */
export const controlsOf = (capture: jest.Mock): string[] =>
    capture.mock.calls
        .filter(([event, props]) => event === ANALYTICS_EVENTS.CONTROL_USED && props?.flow === 'signup')
        .map(([, { control, action, value }]) =>
            [control, action, value].filter((part) => part !== undefined).join(':')
        )

/** Properties of every capture of one event. */
export const eventsOf = (capture: jest.Mock, event: string) =>
    capture.mock.calls.filter(([name]) => name === event).map(([, properties]) => properties)

/** Turns `prefers-reduced-motion: reduce` on for the rest of the test file (restore in afterEach). */
export function setReducedMotion(on: boolean) {
    // jest.setup.ts defines matchMedia writable but not configurable, so assign rather than redefine.
    window.matchMedia = ((query: string) => ({
        matches: on && query.includes('prefers-reduced-motion') && query.includes('reduce'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia
}

/** Texts that no redesigned sign-up screen may show (FLEET-RULES ruling 9, contract banned lists). */
export const BANNED_COPY = [/no password/i, /sin contraseña/i, /\bExample\b/, /\bEjemplo\b/, /\bSuggested\b/]
