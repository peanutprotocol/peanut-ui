/**
 * Shared set-up for the 02 Username component suites (T1). Each suite still declares its own jest.mock calls,
 * because jest hoists mocks per test file; this file holds the render tree, the availability-check stub and the
 * queries every suite uses. Contract: mono _temp/signup-redesign/r2/r9/build/contract/C.md (§ 3.1, § 4, § 9, § 10).
 */
import { screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { type ReactElement, type ReactNode, useLayoutEffect, useState } from 'react'
import { setupScreenIds } from '@/components/Setup/Setup.consts'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { UsernameScreen } from '@/components/Setup/redesign/Username/UsernameScreen'
import {
    loose,
    msg,
    rawMessage,
    renderInShell,
    type TestLocale,
} from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'

export const CHECK_PREFIX = '/users/username/'
export const RESERVATIONS = '/users/username/reservations'

export type CheckAnswer = number | Error | Promise<number>

export const respond = (status: number, body?: unknown) => ({
    status,
    ok: status >= 200 && status < 300,
    url: '',
    json: async () => body ?? {},
    text: async () => JSON.stringify(body ?? {}),
    clone() {
        return this
    },
})

/**
 * Routes the availability check (`/users/username/<name>`) to a per-name answer, else to `fallback`.
 * A number is the HTTP status; an Error is thrown (network); a promise lets a test hold the answer.
 */
export function availabilityStub(answers: Record<string, CheckAnswer>, fallback: CheckAnswer = 404) {
    return async (path: string) => {
        if (!path.startsWith(CHECK_PREFIX) || path === RESERVATIONS) throw new Error(`unexpected request ${path}`)
        const name = decodeURIComponent(path.slice(CHECK_PREFIX.length))
        const answer = name in answers ? answers[name] : fallback
        if (answer instanceof Error) throw answer
        return respond(await answer)
    }
}

/** Names the availability check was asked for, in call order (reservations excluded). */
export const checkedNames = (apiFetch: jest.Mock): string[] =>
    apiFetch.mock.calls
        .map(([path]) => String(path))
        .filter((path) => path.startsWith(CHECK_PREFIX) && path !== RESERVATIONS)
        .map((path) => decodeURIComponent(path.slice(CHECK_PREFIX.length)))

export const checksFor = (apiFetch: jest.Mock, name: string) =>
    checkedNames(apiFetch).filter((checked) => checked === name).length

/** The flow facts the demo path and the refused-name rule write, read from the real context. */
function FlowState() {
    const { username, refusedUsername, signupCompleted, residenceCountry, nationalityCountry, noBackLockScreenId } =
        useSetupFlowContext()
    return (
        <output data-testid="t1-flow-state">
            {JSON.stringify({
                username,
                refusedUsername,
                signupCompleted,
                residenceCountry,
                nationalityCountry,
                noBackLockScreenId,
            })}
        </output>
    )
}

export const flowState = () =>
    JSON.parse(screen.getByTestId('t1-flow-state').textContent ?? '{}') as {
        username: string
        refusedUsername: string | null
        signupCompleted: boolean
        residenceCountry: string
        nationalityCountry: string
        noBackLockScreenId: string | null
    }

/** Seeds the context as the earlier steps (or a return from 03) would, before the screen mounts. */
function Seed({
    username,
    refusedUsername,
    children,
}: {
    username?: string
    refusedUsername?: string
    children: ReactNode
}) {
    const context = useSetupFlowContext()
    const [ready, setReady] = useState(false)
    useLayoutEffect(() => {
        if (username !== undefined) context.setUsername(username)
        if (refusedUsername !== undefined) context.setRefusedUsername(refusedUsername)
        setReady(true)
        // seed once, as the earlier screens would have
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return ready ? <>{children}</> : null
}

export type RenderUsernameOptions = { username?: string; refusedUsername?: string; locale?: TestLocale }

/** 02 as the page renders it: inside SetupShell and the real SetupFlowProvider, with a query client. */
/** The locale of the last render, so the queries below find the field by its translated name. */
let renderedLocale: TestLocale = 'en'

export function renderUsername(options: RenderUsernameOptions = {}) {
    renderedLocale = options.locale ?? 'en'
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrap = (node: ReactElement) => (
        <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter hasMemory searchParams={{ screen: 'signup' }}>
                <SetupFlowProvider masterScreenIds={setupScreenIds}>
                    <Seed username={options.username} refusedUsername={options.refusedUsername}>
                        {node}
                    </Seed>
                    <FlowState />
                </SetupFlowProvider>
            </NuqsTestingAdapter>
        </QueryClientProvider>
    )
    const view = renderInShell('signup', <UsernameScreen />, { locale: options.locale, wrap })
    return { ...view, queryClient }
}

const U = (key: string, values?: Record<string, string | number>, locale?: TestLocale) =>
    msg(`setupRedesign.username.${key}`, values, locale)
export const usernameCopy = U

/** An accessible-name matcher that ignores no-break spaces. */
export const named = (text: string) => (name: string) => loose(name) === loose(text)

export const field = () => screen.getByRole('textbox', { name: named(U('fieldAria', {}, renderedLocale)) })
export const die = () => screen.getByRole('button', { name: named(U('dice', {}, renderedLocale)) })
export const clearButton = () => screen.getByRole('button', { name: named(U('clear', {}, renderedLocale)) })
export const help = () => screen.getByTestId('username-help')
export const counter = () => screen.getByTestId('username-count')
export const card = () => screen.getByTestId('username-card')
export const alternatives = () => screen.queryByTestId('username-alternatives')
/** The footer's primary button (the shell draws it first in `[data-setup-footer]`). */
export const primary = () => {
    const button = document.querySelector('[data-setup-footer] button')
    if (!button) throw new Error('no footer primary button: the screen gave the shell no footer')
    return button as HTMLButtonElement
}
export const helpText = () => loose(help().textContent ?? '')

/** The counter's own `n/12` (a spinner beside it may add its own label). */
export const counterText = () => loose(counter().textContent ?? '').match(/\d+\/12/)?.[0] ?? ''

/**
 * The primary label crossfades (100 ms, shell CrossfadeLabel, framer-motion `mode="wait"`); wait until the new one
 * is on show. framer-motion's exit never completes under jest's fake clock, so a suite on fake timers waits on the
 * real clock here and gets a fresh fake clock back (call it once the screen has settled).
 */
export async function expectPrimaryLabel(text: string) {
    const fake = typeof (globalThis.setTimeout as { clock?: unknown }).clock !== 'undefined'
    if (fake) jest.useRealTimers()
    try {
        await waitFor(() => expect(loose(primary().textContent ?? '')).toBe(loose(text)), { timeout: 2000 })
    } finally {
        if (fake) jest.useFakeTimers()
    }
}

/** The text inside a rich-text tag of a catalog string, e.g. the support link of `checkFailed`. */
export function tagText(key: string, tag: string, locale: TestLocale = 'en') {
    const raw = rawMessage(key, locale)
    const match = typeof raw === 'string' ? raw.match(new RegExp(`<${tag}>(.*?)</${tag}>`)) : null
    if (!match) throw new Error(`catalog ${locale} "${key}" has no <${tag}> tag`)
    return match[1]
}

/** A promise the test resolves by hand. */
export function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

export const USERNAME_PATTERN = /^[a-z][a-z0-9]{3,11}$/

/** Listeners framer-motion (and anyone else) registered on the reduced-motion query. */
const motionListeners = new Set<(event: { matches: boolean }) => void>()
let reduceMotion = false

/**
 * Turns `prefers-reduced-motion: reduce` on or off, the way the OS setting changes: the query's `matches` follows
 * it and its listeners hear the change. framer-motion reads the query once per test run and then only listens, so
 * swapping `matchMedia` without telling the listeners would leave it on the first value. jest.setup.ts defines
 * `window.matchMedia` writable but not configurable, so it is assigned, not redefined.
 */
export function setReducedMotion(on: boolean) {
    reduceMotion = on
    window.matchMedia = ((query: string) => {
        const reduceQuery = query.includes('prefers-reduced-motion')
        const matches = () =>
            reduceMotion && reduceQuery && (query.includes('reduce') || query === '(prefers-reduced-motion)')
        const add = (listener: (event: { matches: boolean }) => void) => reduceQuery && motionListeners.add(listener)
        const remove = (listener: (event: { matches: boolean }) => void) => motionListeners.delete(listener)
        return {
            get matches() {
                return matches()
            },
            media: query,
            onchange: null,
            addListener: add,
            removeListener: remove,
            addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => add(listener),
            removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => remove(listener),
            dispatchEvent: jest.fn(),
        }
    }) as unknown as typeof window.matchMedia
    for (const listener of motionListeners) listener({ matches: on })
}
