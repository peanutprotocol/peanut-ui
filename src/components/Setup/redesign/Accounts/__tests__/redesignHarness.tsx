/**
 * Test harness for the redesigned sign-up screens 05–12 (test writer T2). Not a test file itself.
 *
 * It mounts a screen the way the page does: the real SetupFlowProvider (seeded before the screen mounts), the
 * real SetupShell (so the fixed footer, top bar and `data-setup-*` hooks exist), the real catalogs for the locale,
 * and the app's locale context (so a language switch re-renders the screen). Callers mock only the boundaries:
 * `useSetupFlow` (navigation), server actions, PostHog, network hooks.
 *
 * Copy helpers read the real catalog: a test never hard-codes text a key holds.
 */
import { act, render, type RenderResult, screen } from '@testing-library/react'
import { createTranslator, NextIntlClientProvider } from 'next-intl'
import { cloneElement, isValidElement, type ReactNode, useLayoutEffect, useState } from 'react'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { SetupShell } from '@/components/Setup/redesign/shell/SetupShell'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import type { AppLocale } from '@/i18n/app/config'
import { deepMerge, type DeepPartial } from '@/i18n/app/deep-merge'
import { AppLocaleContext } from '@/i18n/app/locale-context'
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import esAR from '@/i18n/app/messages/es-AR.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'

type Messages = typeof en

/** The catalog the app loads for a locale (es-AR is deltas over es-419 over en, as `loadMessages`). */
export function messagesFor(locale: AppLocale): Messages {
    switch (locale) {
        case 'en':
            return en
        case 'es-419':
            return deepMerge(en, es419 as DeepPartial<Messages>)
        case 'es-AR':
            return deepMerge(deepMerge(en, es419 as DeepPartial<Messages>), esAR as DeepPartial<Messages>)
        case 'pt-BR':
            return deepMerge(en, ptBR as DeepPartial<Messages>)
    }
}

type Values = Record<string, string | number>
type Markup = (key: string, values?: Record<string, unknown>) => string

// Every rich tag the setupRedesign catalog uses; a tag renders as its text, a slot tag as nothing.
const TAGS: Record<string, (chunks: string) => string> = {
    link: (c) => c,
    terms: (c) => c,
    privacy: (c) => c,
    pink: (c) => c,
    nw: (c) => c,
    gap: () => ' ',
    b: (c) => c,
    strong: (c) => c,
    residence: (c) => c,
    nationality: (c) => c,
    funding: (c) => c,
    payment: (c) => c,
}

/** Visible text for a key: markup stripped, no-break spaces as spaces, runs of spaces collapsed. */
export function copy(key: string, values: Values = {}, locale: AppLocale = 'en'): string {
    const t = createTranslator({ locale, messages: messagesFor(locale) }) as unknown as { markup: Markup }
    return t
        .markup(key, { ...TAGS, ...values })
        .replace(/ /g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/** The raw catalog string for a key (tags and placeholders as written). */
export function rawCopy(key: string, locale: AppLocale = 'en'): string {
    const value = key
        .split('.')
        .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messagesFor(locale))
    if (typeof value !== 'string') throw new Error(`no catalog string at ${key} (${locale})`)
    return value
}

/** The text inside one rich tag of a key, e.g. the `<pink>` word of `card.desc`. */
export function tagCopy(key: string, tag: string, locale: AppLocale = 'en'): string {
    const match = rawCopy(key, locale).match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
    if (!match) throw new Error(`no <${tag}> in ${key} (${locale})`)
    return match[1].replace(/ /g, ' ').trim()
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A whole-string matcher for a key's text that accepts any whitespace (no-break spaces) between words. */
export function copyRx(key: string, values: Values = {}, locale: AppLocale = 'en'): RegExp {
    return textRx(copy(key, values, locale))
}

/** The same for literal text (a composed label, a country name). */
export function textRx(text: string, { whole = true }: { whole?: boolean } = {}): RegExp {
    const body = text.split(/\s+/).map(escape).join('[\\s\\u00a0]+')
    return new RegExp(whole ? `^\\s*${body}\\s*$` : body)
}

/** Text content with no-break spaces as spaces and whitespace collapsed. */
export const visibleText = (el: Element | null | undefined) =>
    (el?.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

/**
 * A getByText matcher for text split over several elements (a rich tag inside a sentence): the deepest element
 * whose visible text equals `text`.
 */
export const textMatch =
    (text: string) =>
    (_: string, el: Element | null): boolean =>
        !!el && visibleText(el) === text && !Array.from(el.children).some((child) => visibleText(child) === text)

export type FlowState = ReturnType<typeof useSetupFlowContext>
export type FlowSeed = Partial<
    Pick<
        FlowState,
        | 'residenceCountry'
        | 'nationalityCountry'
        | 'fundingChannel'
        | 'paymentChannel'
        | 'notificationEmail'
        | 'notificationChoices'
        | 'signupCompleted'
        | 'signupEntryFlow'
        | 'username'
    >
>

const SEED_SETTERS: { [K in keyof Required<FlowSeed>]: (flow: FlowState, value: FlowSeed[K]) => void } = {
    residenceCountry: (f, v) => f.setResidenceCountry(v ?? ''),
    nationalityCountry: (f, v) => f.setNationalityCountry(v ?? ''),
    fundingChannel: (f, v) => f.setFundingChannel(v ?? null),
    paymentChannel: (f, v) => f.setPaymentChannel(v ?? null),
    notificationEmail: (f, v) => f.setNotificationEmail(v ?? ''),
    notificationChoices: (f, v) => v && f.setNotificationChoices(v),
    signupCompleted: (f, v) => f.setSignupCompleted(!!v),
    signupEntryFlow: (f, v) => v && f.setSignupEntryFlow(v),
    username: (f, v) => f.setUsername(v ?? ''),
}

/** Seeds the flow, then mounts the screen, so the screen's first render already sees the seeded answers. */
function Seeded({
    seed,
    probe,
    children,
}: {
    seed: FlowSeed
    probe: { current: FlowState | null }
    children: ReactNode
}) {
    const flow = useSetupFlowContext()
    probe.current = flow
    const [ready, setReady] = useState(false)
    useLayoutEffect(() => {
        for (const [key, value] of Object.entries(seed)) {
            ;(SEED_SETTERS as Record<string, (f: FlowState, v: unknown) => void>)[key](flow, value)
        }
        setReady(true)
        // seed once, before the screen mounts
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return ready ? children : null
}

const MASTER: ScreenId[] = [
    'landing',
    'advantage-fees',
    'advantage-card',
    'residence',
    'payment-plan',
    'signup',
    'invite',
    'passkey',
    'notification-email',
    'notification-permission',
    'advantage-control',
]

export type RedesignRenderOptions = {
    screenId: ScreenId
    locale?: AppLocale
    seed?: FlowSeed
    /** A host that finishes the flow itself (the verify prelude). */
    onFinish?: () => Promise<void>
    /** Mount inside SetupShell (default) so the footer and top bar render. */
    shell?: boolean
    showBackButton?: boolean
    onBack?: () => void
    progress?: { index: number; total: number } | null
}

export type RedesignRenderResult = RenderResult & {
    /** The live flow context (residence, plan, email, choices...). */
    flow: () => FlowState
    /** Switch the app language; the screen re-renders with the new catalog. */
    setLocale: (locale: AppLocale) => Promise<void>
    /** Re-render the same tree (after mutating a mocked hook's return). */
    rerenderSame: () => void
}

/** Render a redesigned step the way the sign-up page mounts it. */
export function renderRedesign(ui: ReactNode, options: RedesignRenderOptions): RedesignRenderResult {
    const { screenId, seed = {}, onFinish, shell = true, showBackButton = false, onBack, progress = null } = options
    const probe: { current: FlowState | null } = { current: null }
    const localeRef: { set: ((l: AppLocale) => void) | null } = { set: null }

    function Root({ children }: { children: ReactNode }) {
        const [locale, setLocaleState] = useState<AppLocale>(options.locale ?? 'en')
        localeRef.set = setLocaleState
        const setLocale = async (next: AppLocale) => setLocaleState(next)
        return (
            <AppLocaleContext.Provider value={{ locale, setLocale }}>
                <NextIntlClientProvider locale={locale} messages={messagesFor(locale)} timeZone="UTC">
                    {children}
                </NextIntlClientProvider>
            </AppLocaleContext.Provider>
        )
    }

    // A fresh element on every render, so a rerender re-reads mocked hooks instead of bailing out.
    const step = () => (isValidElement(ui) ? cloneElement(ui) : ui)
    const tree = () => (
        <Root>
            <SetupFlowProvider masterScreenIds={MASTER} onFinish={onFinish}>
                <Seeded seed={seed} probe={probe}>
                    {shell ? (
                        <SetupShell
                            screenId={screenId}
                            showBackButton={showBackButton}
                            onBack={onBack}
                            progress={progress}
                        >
                            {step()}
                        </SetupShell>
                    ) : (
                        step()
                    )}
                </Seeded>
            </SetupFlowProvider>
        </Root>
    )

    const result = render(tree())
    return {
        ...result,
        flow: () => {
            if (!probe.current) throw new Error('flow context not mounted')
            return probe.current
        },
        setLocale: async (locale) => {
            await act(async () => localeRef.set?.(locale))
        },
        rerenderSame: () => result.rerender(tree()),
    }
}

/** The fixed footer the shell draws for the screen on show. */
export const footer = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-setup-footer]')

/** The state the screen reports on its stage (`data-setup-state`). */
export const setupState = (container: HTMLElement) =>
    container.querySelector('[data-setup-stage]')?.getAttribute('data-setup-state') ?? null

/**
 * The open dialog (a drawer), or null. A closed vaul drawer stays in the DOM with `data-state="closed"` while it
 * animates out, so "closed" means no dialog whose state is not closed.
 */
export const openDialog = (name?: string | RegExp): HTMLElement | null =>
    screen
        .queryAllByRole('dialog', name ? { name, hidden: true } : { hidden: true })
        .find((d) => d.getAttribute('data-state') !== 'closed') ?? null
