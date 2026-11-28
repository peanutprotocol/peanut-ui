/** @jest-environment jsdom */
// Contract P1 (01 Landing): render, copy and the web download-only landing. Checks P1-01…P1-05, P1-36, P1-37.
jest.mock('@/hooks/useLogin', () => require('./landing-state').useLoginModule())
jest.mock('@/hooks/useSetupFlow', () => require('./landing-state').useSetupFlowModule())
jest.mock('@/features/setup/SetupFlowContext', () => require('./landing-state').setupFlowContextModule())
jest.mock('@/features/setup/signup-draft', () => require('./landing-state').signupDraftModule())
jest.mock('@/utils/capacitor', () => require('./landing-state').capacitorModule())
jest.mock('@/utils/native-platform', () => require('./landing-state').nativePlatformModule())
jest.mock('@/hooks/useGetDeviceType', () => require('./landing-state').deviceTypeModule())
jest.mock('@/hooks/useKeepWebBypass', () => require('./landing-state').keepWebModule())
jest.mock('@/constants/migration.consts', () => require('./landing-state').migrationModule())
jest.mock('@/components/Migration/StoreButtons', () => require('./landing-state').storeButtonsModule())
jest.mock('@/components/0_Bruddle/Toast', () => require('./landing-state').toastModule())
jest.mock('@sentry/nextjs', () => require('./landing-state').sentryModule())
jest.mock('@/utils/sentry-lazy', () => require('./landing-state').sentryModule())
jest.mock('posthog-js', () => require('./landing-state').posthogModule())
jest.mock('lottie-web/build/player/lottie_light', () => require('./landing-state').lottieModule())
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () =>
    require('./landing-state').languageSwitcherModule()
)
// P1-03: the welcome-headline experiment's three modules are deleted, so the landing cannot import them.

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { LandingScreen } from '@/components/Setup/redesign/Landing/LandingScreen'
import { landing, resetLanding, setPlatform } from './landing-state'
import {
    logInButton,
    named,
    passkeyError,
    querySignUpButton,
    recoveryLinkText,
    signUpButton,
    tapLogIn,
} from './landing-helpers'
import { BANNED_COPY, CATALOGS, loose, msg, rawMessage, renderInShell, setupState, textOf } from './redesign-harness'
import type { TestLocale } from './redesign-harness'

const footer = () => document.querySelector('[data-setup-footer]') as HTMLElement | null
const panel = () => document.querySelector('[data-setup-panel]') as HTMLElement

/** The innermost element whose text is exactly the string, no-break spaces included. */
const exactly = (expected: string) => (_: string, element: Element | null) =>
    !!element &&
    element.textContent === expected &&
    Array.from(element.children).every((child) => child.textContent !== expected)

beforeEach(() => {
    jest.useFakeTimers()
    resetLanding()
    window.localStorage.clear()
})
afterEach(() => jest.useRealTimers())

describe('01 Landing — render and copy', () => {
    it('P1-01 native app, fresh mount: X1 headline, sub line, no money card, Sign up before Log in, no link, state default', () => {
        renderInShell('landing', <LandingScreen />)

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(loose(msg('setupRedesign.landing.title')))
        expect(within(panel()).getByText(textOf(msg('setupRedesign.landing.sub')))).toBeInTheDocument()
        // The "Money received! USD 1,200" card is gone: on an invite link it read as money waiting for the visitor.
        expect(screen.getByTestId('landing-hero')).toBeInTheDocument()
        expect(screen.queryByTestId('landing-money-card')).not.toBeInTheDocument()
        expect(document.body.textContent).not.toMatch(/Money received|USD 1,200/)

        const signUp = signUpButton()
        const logIn = logInButton()
        expect(footer()).not.toBeNull()
        expect(footer()).toContainElement(signUp)
        expect(footer()).toContainElement(logIn)
        expect(signUp).toHaveClass('btn-primary')
        expect(logIn).toHaveClass('btn-secondary')
        expect(signUp.compareDocumentPosition(logIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(signUp).toBeEnabled()
        expect(logIn).toBeEnabled()
        expect(screen.queryByText(textOf(recoveryLinkText()))).not.toBeInTheDocument()
        expect(screen.queryByTestId('landing-recovery-link')).not.toBeInTheDocument()
        expect(setupState()).toBe('default')
    })

    it.each(['en', 'es-AR'] as TestLocale[])(
        'P1-02 (%s) the title and the sub line keep their no-break spaces exactly where the catalog has them',
        (locale) => {
            const title = msg('setupRedesign.landing.title', {}, locale)
            const sub = msg('setupRedesign.landing.sub', {}, locale)
            expect(title).toContain(' ')
            expect(sub).toContain(' ')
            renderInShell('landing', <LandingScreen />, { locale })

            expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title)
            expect(within(panel()).getByText(exactly(sub))).toBeInTheDocument()
        }
    )

    it('P1-03 renders none of the old landing copy and imports nothing from the welcome-headline experiment', () => {
        // The three experiment modules throw on import (mocks above): a render that reaches them fails here.
        renderInShell('landing', <LandingScreen />)
        const text = loose(document.body.textContent ?? '')
        // dev's old landing copy (setup.steps.landing), pinned: the keys left the catalogs with the old view
        const strings = [
            'Earn anywhere. Spend worldwide.',
            'Get paid in USD or EUR with bank details. Spend it by card or QR, wherever you are.',
        ]
        for (const string of strings) expect(text).not.toContain(loose(string))
    })

    it('P1-04 en and es-AR hold the 5 landing keys with the exact strings; es-419 and pt-BR hold the same keys', () => {
        // F's catalog names: `cta` is the mock's landing.cta (Sign up), `loginBtn` its landing.loginBtn, relabelled
        // "I already have an account" (TASK-25289, from ui#4086).
        const expected: Record<'en' | 'es-AR', Record<string, string>> = {
            en: {
                title: 'Get paid from the US and Europe.',
                sub: 'Receive from abroad. Pay by QR in Argentina and Brazil, or anywhere Visa is accepted.',
                cta: 'Sign up',
                loginBtn: 'I already have an account',
                recover: 'Need to recover a Peanut account?',
            },
            'es-AR': {
                title: 'Cobrá desde EE. UU. y Europa.',
                sub: 'Recibí desde el exterior. Pagá con QR en Argentina y Brasil, o donde acepten Visa.',
                cta: 'Registrate',
                loginBtn: 'Ya tengo cuenta',
                recover: '¿Necesitás recuperar la cuenta de Peanut?',
            },
        }
        for (const locale of ['en', 'es-AR'] as const) {
            expect(rawMessage('setupRedesign.landing', locale)).toEqual(expect.objectContaining(expected[locale]))
        }
        for (const locale of ['es-419', 'pt-BR'] as const) {
            for (const key of Object.keys(expected.en)) {
                const value = rawMessage(`setupRedesign.landing.${key}`, locale)
                expect({ locale, key, type: typeof value }).toEqual({ locale, key, type: 'string' })
                expect((value as string).trim()).not.toBe('')
            }
        }
        for (const locale of Object.keys(CATALOGS) as TestLocale[]) {
            expect(rawMessage('setupRedesign.landing.cardReceived', locale)).toBeUndefined()
            expect(rawMessage('setupRedesign.landing.cardAmount', locale)).toBeUndefined()
        }
        expect(Object.keys(CATALOGS)).toHaveLength(4)
    })

    it('P1-05 no state of the landing shows "no password", "Example", "UK" or their Spanish forms', async () => {
        const banned = [...BANNED_COPY, /\bUK\b/]
        const check = () => {
            const text = document.body.textContent ?? ''
            for (const pattern of banned) expect(text).not.toMatch(pattern)
        }
        // default (native) in en and es-AR
        for (const locale of ['en', 'es-AR'] as TestLocale[]) {
            const view = renderInShell('landing', <LandingScreen />, { locale })
            check()
            view.unmount()
        }
        // login-failed + toast
        landing.login.mockRejectedValue(passkeyError('LOGIN_ERROR'))
        let view = renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await waitFor(() => expect(landing.toastError).toHaveBeenCalled())
        check()
        for (const [message] of landing.toastError.mock.calls)
            for (const p of banned) expect(String(message)).not.toMatch(p)
        view.unmount()
        // account deleted
        landing.login.mockRejectedValue(passkeyError('ACCOUNT_DELETED'))
        view = renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await screen.findByTestId('account-deleted')
        check()
        view.unmount()
        // recovery drawer
        landing.login.mockRejectedValue(passkeyError('PASSKEY_NOT_FOUND'))
        view = renderInShell('landing', <LandingScreen />)
        await tapLogIn()
        await screen.findByRole('dialog')
        check()
        view.unmount()
        // web download-only
        setPlatform('web')
        view = renderInShell('landing', <LandingScreen />)
        check()
        view.unmount()
    })
})

describe('01 Landing — web download-only (K13, S6)', () => {
    it('P1-36 web without keep-web: store buttons and "Log in on web instead", no Sign up, no fixed footer; the heading above the store buttons', () => {
        setPlatform('web')
        renderInShell('landing', <LandingScreen />)

        const store = screen.getByTestId('store-buttons')
        expect(screen.getByRole('button', { name: named(msg('migration.qr.logIn')) })).toBeEnabled()
        expect(querySignUpButton()).not.toBeInTheDocument()
        expect(footer()).toBeNull()
        const heading = screen.getByText(textOf(msg('migration.banner.title')))
        expect(heading.compareDocumentPosition(store) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        // the X1 stage and headline stay (ruling 7)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(loose(msg('setupRedesign.landing.title')))
    })

    it('P1-37 test build on the web: "Test build" and "Sign up on web" show and start sign-up once; not without the build flag, never in the app', async () => {
        setPlatform('web')
        landing.testBuild = true
        let view = renderInShell('landing', <LandingScreen />)
        expect(screen.getByText(textOf(msg('setup.landing.testBuild')))).toBeInTheDocument()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: named(msg('setup.landing.testSignUp')) }))
        })
        expect(landing.next).toHaveBeenCalledTimes(1)
        view.unmount()

        landing.testBuild = false
        view = renderInShell('landing', <LandingScreen />)
        expect(screen.queryByText(textOf(msg('setup.landing.testBuild')))).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: named(msg('setup.landing.testSignUp')) })).not.toBeInTheDocument()
        view.unmount()

        setPlatform('iphone')
        landing.testBuild = true
        renderInShell('landing', <LandingScreen />)
        expect(signUpButton()).toBeInTheDocument()
        expect(screen.queryByText(textOf(msg('setup.landing.testBuild')))).not.toBeInTheDocument()
    })
})
