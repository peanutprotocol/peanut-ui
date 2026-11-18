/**
 * The redesigned sign-up, end to end (TASK-25016): every journey in dev's screen order
 * (Landing → Accounts → Card → Residence → Plan → Username → Invite → Passkey → Email → Notifications → Final),
 * against the contracts in mono _temp/signup-redesign/r2/r9/build/contract/ (checks tagged e2e).
 *
 * WHAT THIS PROVES
 * - The browser side of the flow: which screen and state shows after each tap, what the page sends, the back lock,
 *   the on-device draft and resume, the URL never carrying the username.
 * - The real WebAuthn ceremony in Chromium: a CDP virtual authenticator (`WebAuthn.addVirtualAuthenticator`) creates
 *   and signs with a P-256 credential, so the ZeroDev key import, the cancel path (user not verified) and the retry
 *   run the app's own code.
 * - Every API request the page makes reaches one recording stub (routed in the page, whatever API host the build
 *   bakes in), so a check can say "the API saw the residence once, after registration".
 *
 * WHAT IT DOES NOT PROVE
 * - That an account exists: the passkey server, the API, the database and the ZeroDev bundler are stubs. The stub
 *   answers what the UI expects; a drift in the real API shape passes here (api-contract checks that).
 * - Analytics: preview builds load PostHog with capture opted out, so no event leaves the page. Event checks live in
 *   the component tests.
 * - Native passkey sheets (iOS, Android app), the OS notification prompt and the 15-second entry failure.
 * Real account creation is checked on staging and on a phone (DELIVERY-PLAN risk 3).
 *
 * HOW TO RUN (one worker: the stub is one module-level object)
 *   NEXT_PUBLIC_VERCEL_ENV=preview npm run build && \
 *   REGRESSION_HOST=localhost npm run test:e2e:regression -- signup-redesign --workers=1
 * REGRESSION_HOST=localhost is required: WebAuthn refuses 127.0.0.1 as the relying party.
 * The last step signs a UserOp through the ZeroDev bundler. A build without NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL stops it
 * at setup-failed, so 11 → 12 is checked only with SIGNUP_E2E_STUB_BUNDLER=1 and a build whose bundler and paymaster
 * URLs point at any host this spec routes, as mono _temp/signup-redesign/r2/r9/build/gate/gate.sh does:
 *   NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL=https://bundler.e2e.invalid/rpc \
 *   NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL=https://paymaster.e2e.invalid/rpc
 */

import { expect, test, type BrowserContext, type CDPSession, type Page, type Route } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import en from '../../src/i18n/app/messages/en.json'
import esAR from '../../src/i18n/app/messages/es-AR.json'
import es419 from '../../src/i18n/app/messages/es-419.json'
import { KEEP_WEB_COOKIE, KEEP_WEB_TOKEN } from '../../src/constants/migration.consts'

/** The build sends the bundler to a host the spec answers, so the last step can sign and finish (see header). */
const STUB_BUNDLER = !!process.env.SIGNUP_E2E_STUB_BUNDLER

// ---------------------------------------------------------------------------------------------------------------
// Copy: the catalog strings the screens render, so a check reads like the screen.
// ---------------------------------------------------------------------------------------------------------------

type Locale = 'en' | 'es-AR'
type Catalog = Record<string, unknown>
// es-AR overrides es-419, which falls back to en, as the app loads them
const CATALOGS: Record<Locale, Catalog[]> = {
    en: [en as Catalog],
    'es-AR': [esAR as Catalog, es419 as Catalog, en as Catalog],
}

/** A plain-text catalog string: rich-text tags dropped, no-break spaces as spaces, `{name}`-style values filled. */
function copy(locale: Locale, key: string, values: Record<string, string> = {}): string {
    const raw = CATALOGS[locale]
        .map((catalog) =>
            key.split('.').reduce<unknown>((node, part) => (node as Catalog | undefined)?.[part], catalog)
        )
        .find((value) => typeof value === 'string')
    if (typeof raw !== 'string') throw new Error(`no copy for ${locale} ${key}`)
    return raw
        .replace(/<\/?[a-z]+>/g, '')
        .replace(/ /g, ' ')
        .replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? `{${name}}`)
}

// ---------------------------------------------------------------------------------------------------------------
// The recording API stub: one answer table for every API call the page makes (routed in the page).
// ---------------------------------------------------------------------------------------------------------------

type Recorded = {
    origin: 'browser'
    method: string
    path: string
    body: unknown
    headers: Record<string, string>
}
type Answer = { status: number; json?: unknown; headers?: Record<string, string> }

const E2E_ADDRESS = '0x00000000000000000000000000000000000e2e01'
const E2E_USER_ID = 'e2e-user'

class SignupStub {
    requests: Recorded[] = []
    /** Usernames that already have an account (HEAD /users/username/:name answers 200). */
    takenNames = new Set<string>()
    /** Usernames that turn taken the moment the passkey step checks them again (C-61). */
    takenAtPasskey = new Set<string>()
    /** Inviter handles the invite lookup finds. */
    inviters = new Set(['fulano'])
    /** Extra latency per `METHOD /path` key, in ms (the slow-network journey). */
    delays = new Map<string, number>()
    registered: {
        username: string
        email: string | null
        residence: unknown
        wallet: Record<string, unknown> | null
    } | null = null
    unhandled: string[] = []

    reset() {
        Object.assign(this, new SignupStub())
    }

    seen(method: string, path: string | RegExp) {
        return this.requests.filter(
            (r) => r.method === method && (typeof path === 'string' ? r.path === path : path.test(r.path))
        )
    }

    private user() {
        const username = this.registered?.username ?? ''
        return {
            streak: 0,
            pwQueue: { totalUsers: 0, userPosition: null },
            totalPoints: 0,
            contacts: [],
            rails: [],
            invitesSent: [],
            showEarlyUserModal: false,
            invitedBy: null,
            // the final step's /add-account, as the API would store it: the wallet and the chosen plan
            signupPreferences: this.registered?.wallet?.signupPreferences ?? null,
            accounts: this.registered?.wallet
                ? [
                      {
                          id: 'e2e-wallet',
                          userId: E2E_USER_ID,
                          type: this.registered.wallet.accountType ?? 'peanut-wallet',
                          identifier: this.registered.wallet.accountIdentifier ?? E2E_ADDRESS,
                          chainId: '42161',
                          details: {},
                          createdAt: '2026-11-16T00:00:00.000Z',
                          updatedAt: '2026-11-16T00:00:00.000Z',
                      },
                  ]
                : [],
            user: {
                userId: E2E_USER_ID,
                email: this.registered?.email ?? null,
                profile_picture: null,
                username,
                bridgeCustomerId: null,
                fullName: null,
                telegram: null,
                hasAppAccess: true,
                showFullName: false,
                createdAt: '2026-11-16T00:00:00.000Z',
                accounts: [],
                badges: [],
            },
        }
    }

    async handle(
        origin: Recorded['origin'],
        method: string,
        url: string,
        body: unknown,
        headers: Record<string, string>
    ): Promise<Answer> {
        const path = new URL(url, 'http://stub.local').pathname.replace(/\/+$/, '') || '/'
        this.requests.push({ origin, method, path, body, headers })
        const delay = this.delays.get(`${method} ${path}`)
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
        const name = path.match(/^\/users\/username\/([^/]+)$/)?.[1]?.toLowerCase()

        if (name && (method === 'HEAD' || method === 'GET')) {
            // C-61: someone registers the name between its reservation on 02 and the tap on 03
            const reserved = this.seen('POST', '/users/username/reservations').some(
                (r) => (r.body as { username?: string })?.username === name
            )
            if (this.takenNames.has(name) || (this.takenAtPasskey.has(name) && reserved))
                return { status: 200, json: { username: name } }
            if (this.registered?.username === name) return { status: 200, json: { username: name } }
            return { status: 404, json: { error: 'not found' } }
        }
        switch (`${method} ${path}`) {
            case 'POST /users/username/reservations': {
                const wanted = String((body as { username?: string })?.username ?? '').toLowerCase()
                if (this.takenNames.has(wanted)) return { status: 409, json: { code: 'USERNAME_TAKEN' } }
                return { status: 200, json: { username: wanted, expiresAt: '2030-01-01T00:00:00.000Z' } }
            }
            case 'POST /users/username/holds':
            case 'POST /users/username/hold-token':
                return { status: 200, json: { token: 'e2e-hold' } }
            case 'POST /passkeys/register/options': {
                const passkeyName = String((body as { username?: string })?.username ?? '')
                const rpID = String((body as { rpID?: string })?.rpID ?? 'localhost')
                return {
                    status: 200,
                    json: {
                        userId: E2E_USER_ID,
                        options: {
                            challenge: b64url(randomBytes(32)),
                            rp: { name: 'Peanut', id: rpID },
                            user: { id: b64url(Buffer.from(E2E_USER_ID)), name: passkeyName, displayName: passkeyName },
                            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
                            timeout: 5000,
                            attestation: 'none',
                            authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
                        },
                    },
                }
            }
            case 'POST /passkeys/register/verify': {
                const passkeyName = String((body as { username?: string })?.username ?? '')
                this.registered = {
                    username: passkeyName.replace(/\.peanut\.wallet$/, ''),
                    email: null,
                    residence: null,
                    wallet: null,
                }
                return { status: 200, json: { verified: true, token: 'e2e-jwt' } }
            }
            case 'POST /passkeys/login/options': {
                const rpID = String((body as { rpID?: string })?.rpID ?? 'localhost')
                return {
                    status: 200,
                    json: {
                        challenge: b64url(randomBytes(32)),
                        rpId: rpID,
                        allowCredentials: [],
                        timeout: 3000,
                        userVerification: 'required',
                    },
                }
            }
            case 'GET /users/me':
            case 'GET /get-user':
                return this.registered
                    ? { status: 200, json: this.user() }
                    : { status: 401, json: { error: 'unauthorized' } }
            case 'POST /update-user': {
                const update = body as Record<string, unknown>
                if (!this.registered) return { status: 401, json: { error: 'unauthorized' } }
                if (typeof update.email === 'string') {
                    if (/^taken@/i.test(update.email))
                        return { status: 409, json: { code: 'EMAIL_IN_USE', message: 'Email already in use' } }
                    this.registered.email = update.email
                }
                if ('residenceCountry' in update || 'nationality' in update) this.registered.residence = update
                return { status: 200, json: this.user().user }
            }
            case 'POST /add-account':
                // the wallet the final step creates; the account is complete from here on
                if (!this.registered) return { status: 401, json: { error: 'unauthorized' } }
                this.registered.wallet = (body as Record<string, unknown>) ?? {}
                return { status: 200, json: { success: true } }
            case 'POST /invites/validate': {
                const code = String((body as { inviteCode?: string })?.inviteCode ?? '').toLowerCase()
                const handle = code.replace(/invitesyou$/, '')
                if (this.inviters.has(handle))
                    return {
                        status: 200,
                        json: { success: true, username: handle, attributionResolved: true, onboardingResolved: true },
                    }
                return { status: 404, json: { error: 'Invite not found' } }
            }
            case 'GET /config/residence-restrictions':
                return {
                    status: 200,
                    json: {
                        full: ['CN', 'IR', 'RU', 'BY', 'GB', 'KP', 'SY', 'CU', 'MM', 'VE'],
                        cardOnly: [],
                        bankingOnly: [],
                        refusedIdIssuers: ['IR', 'BY', 'KP', 'SY', 'CU', 'MM'],
                        bankingNewCustomersOnly: [],
                    },
                }
            case 'GET /config/kill-switches':
                return { status: 200, json: {} }
        }
        if (path.startsWith('/notifications') || path.startsWith('/users/me/') || path.startsWith('/invites'))
            return { status: 200, json: {} }
        this.unhandled.push(`${origin} ${method} ${path}`)
        return { status: 404, json: { error: 'e2e stub: no answer' } }
    }
}

const b64url = (bytes: Buffer) => bytes.toString('base64url')

const stub = new SignupStub()

// ---------------------------------------------------------------------------------------------------------------
// Chain RPC and the ZeroDev bundler: just enough for a counterfactual kernel account and one sponsored UserOp.
// ---------------------------------------------------------------------------------------------------------------

const GET_SENDER_ADDRESS = '0x9b249f69'
const SENDER_ADDRESS_RESULT = '0x6ca7b806'
const GET_NONCE = '0x35567e1a'
const word = (hex: string) => hex.replace(/^0x/, '').padStart(64, '0')
const USER_OP_HASH = `0x${'e2'.repeat(32)}`

function rpcResult(method: string, params: unknown[]): { result?: unknown; error?: unknown } {
    switch (method) {
        case 'eth_chainId':
            return { result: '0xa4b1' }
        case 'net_version':
            return { result: '42161' }
        case 'eth_blockNumber':
            return { result: '0x100' }
        case 'eth_getCode':
            return { result: '0x' }
        case 'eth_getBalance':
            return { result: '0x0' }
        case 'eth_gasPrice':
        case 'eth_maxPriorityFeePerGas':
            return { result: '0x1' }
        case 'eth_getBlockByNumber':
            return {
                result: {
                    number: '0x100',
                    baseFeePerGas: '0x1',
                    timestamp: '0x6738f000',
                    hash: `0x${'11'.repeat(32)}`,
                },
            }
        case 'eth_call': {
            const data = String((params[0] as { data?: string })?.data ?? '')
            if (data.startsWith(GET_SENDER_ADDRESS))
                return {
                    error: { code: 3, message: 'execution reverted', data: SENDER_ADDRESS_RESULT + word(E2E_ADDRESS) },
                }
            if (data.startsWith(GET_NONCE)) return { result: `0x${word('0')}` }
            return { result: `0x${word('0')}` }
        }
        case 'eth_supportedEntryPoints':
            return { result: ['0x0000000071727De22E5E9d8BAf0edAc6f37da032'] }
        case 'zd_getUserOperationGasPrice': {
            const tier = { maxFeePerGas: '0x1', maxPriorityFeePerGas: '0x1' }
            return { result: { slow: tier, standard: tier, fast: tier } }
        }
        case 'eth_estimateUserOperationGas':
            return {
                result: {
                    preVerificationGas: '0x10000',
                    verificationGasLimit: '0x100000',
                    callGasLimit: '0x10000',
                    paymasterVerificationGasLimit: '0x10000',
                    paymasterPostOpGasLimit: '0x1',
                },
            }
        case 'pm_sponsorUserOperation':
        case 'zd_sponsorUserOperation':
        case 'pm_getPaymasterStubData':
        case 'pm_getPaymasterData':
            return {
                result: {
                    paymaster: '0x00000000000000000000000000000000000e2e02',
                    paymasterData: '0x',
                    paymasterVerificationGasLimit: '0x10000',
                    paymasterPostOpGasLimit: '0x1',
                    preVerificationGas: '0x10000',
                    verificationGasLimit: '0x100000',
                    callGasLimit: '0x10000',
                },
            }
        case 'eth_sendUserOperation':
            return { result: USER_OP_HASH }
        case 'eth_getUserOperationReceipt':
            return {
                result: {
                    userOpHash: USER_OP_HASH,
                    sender: E2E_ADDRESS,
                    nonce: '0x0',
                    success: true,
                    actualGasCost: '0x0',
                    actualGasUsed: '0x0',
                    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
                    logs: [],
                    receipt: {
                        transactionHash: `0x${'e3'.repeat(32)}`,
                        blockNumber: '0x100',
                        blockHash: `0x${'11'.repeat(32)}`,
                        status: '0x1',
                        logs: [],
                        gasUsed: '0x0',
                    },
                },
            }
    }
    return { error: { code: -32601, message: `e2e stub: no ${method}` } }
}

function answerRpcBody(raw: string): string {
    const parsed = JSON.parse(raw) as
        | { id?: unknown; method: string; params?: unknown[] }
        | Array<{ id?: unknown; method: string; params?: unknown[] }>
    const one = (call: { id?: unknown; method: string; params?: unknown[] }) => {
        const answer = rpcResult(call.method, call.params ?? [])
        if (answer.error) stub.unhandled.push(`rpc ${call.method}`)
        return { jsonrpc: '2.0', id: call.id ?? 1, ...answer }
    }
    stub.requests.push({
        origin: 'browser',
        method: 'RPC',
        path: Array.isArray(parsed) ? parsed.map((c) => c.method).join(',') : parsed.method,
        body: parsed,
        headers: {},
    })
    return JSON.stringify(Array.isArray(parsed) ? parsed.map(one) : one(parsed))
}

// ---------------------------------------------------------------------------------------------------------------
// Page wiring
// ---------------------------------------------------------------------------------------------------------------

const API_PATH =
    /^\/(users|invites|passkeys|config|update-user|get-user|notifications|history|version|badges|points|rewards|kyc|attention|onboarding|referrals|campaigns|add-account|rain|user|avatars)(\/|$)/
const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS',
}

async function routeEverything(page: Page, baseURL: string) {
    const local = new URL(baseURL).host
    await page.route('**/*', async (route: Route) => {
        const request = route.request()
        const url = new URL(request.url())
        const raw = request.postData() ?? ''
        if (url.host === local) {
            if (url.pathname.startsWith('/passkeys/'))
                return fulfil(
                    route,
                    await stub.handle('browser', request.method(), url.pathname, parse(raw), request.headers()),
                    true
                )
            if (url.pathname === '/api/geo-country') return route.fulfill({ json: { country: 'AR' }, headers: CORS })
            return route.continue()
        }
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
        if (raw.includes('"jsonrpc"'))
            return route.fulfill({
                status: 200,
                headers: CORS,
                contentType: 'application/json',
                body: answerRpcBody(raw),
            })
        if (API_PATH.test(url.pathname))
            return fulfil(
                route,
                await stub.handle('browser', request.method(), url.pathname, parse(raw), request.headers())
            )
        return route.abort()
    })
}

function parse(raw: string): unknown {
    try {
        return raw ? JSON.parse(raw) : undefined
    } catch {
        return raw
    }
}

async function fulfil(route: Route, answer: Answer, sameOrigin = false) {
    // The passkey verify sets the session cookie the API would set on the same origin.
    if (sameOrigin && answer.json && (answer.json as { verified?: boolean }).verified) {
        await route
            .request()
            .frame()
            .page()
            .context()
            .addCookies([{ name: 'jwt-token', value: 'e2e-jwt', url: route.request().url() }])
    }
    return route.fulfill({
        status: answer.status,
        headers: { ...CORS, ...answer.headers },
        contentType: 'application/json',
        body: route.request().method() === 'HEAD' ? '' : JSON.stringify(answer.json ?? {}),
    })
}

/** A phone's safe area as the mock draws it (status bar 47, home bar 34), so the CTA tops match the contracts. */
function phoneInsets() {
    const apply = () => {
        document.documentElement.style.setProperty('--safe-area-inset-top', '47px')
        document.documentElement.style.setProperty('--safe-area-inset-bottom', '34px')
    }
    if (document.documentElement) apply()
    else document.addEventListener('DOMContentLoaded', apply)
}

function seedGeo() {
    window.sessionStorage.setItem('user_geo_country_code', 'AR')
    window.sessionStorage.setItem('user_geo_country_code_timestamp', String(Date.now()))
}

type Authenticator = { cdp: CDPSession; id: string }

/** A Chromium virtual platform authenticator: Face ID, fingerprint or screen lock, without a person. */
async function addAuthenticator(page: Page, verified = true): Promise<Authenticator> {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
            protocol: 'ctap2',
            transport: 'internal',
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: verified,
            automaticPresenceSimulation: true,
        },
    })
    return { cdp, id: authenticatorId }
}

async function openSetup(page: Page, context: BrowserContext, baseURL: string, path = '/setup') {
    // WebAuthn refuses an IP address as the relying party; without this every journey stops on 03's help drawer
    if (new URL(baseURL).hostname !== 'localhost') throw new Error('run with REGRESSION_HOST=localhost (see header)')
    const origin = baseURL
    const language = await page.evaluate(() => navigator.language)
    await context.addCookies([
        { name: KEEP_WEB_COOKIE, value: encodeURIComponent(JSON.stringify(KEEP_WEB_TOKEN)), url: origin },
        { name: 'app-locale', value: language.startsWith('es') ? 'es-AR' : 'en', url: origin },
    ])
    await page.addInitScript(phoneInsets)
    await page.addInitScript(seedGeo)
    await routeEverything(page, origin)
    await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' })
}

// ---------------------------------------------------------------------------------------------------------------
// Reading the screen
// ---------------------------------------------------------------------------------------------------------------

/** The step on show (`data-setup-screen` on the shell) and the state of its stage (`data-setup-state`). */
async function current(page: Page) {
    return page.evaluate(() => {
        const shell = document.querySelector('[data-setup-shell]')
        const slide = Array.from(document.querySelectorAll('[data-setup-slide]')).find(
            (el) => !el.getAttribute('aria-hidden')
        )
        const stage = slide?.querySelector('[data-setup-stage]')
        return {
            screen: shell?.getAttribute('data-setup-screen') ?? null,
            state: stage?.getAttribute('data-setup-state') ?? null,
        }
    })
}

async function expectScreen(page: Page, screen: string, state?: string, timeout = 15_000) {
    await expect.poll(async () => (await current(page)).screen, { message: `screen ${screen}`, timeout }).toBe(screen)
    if (state)
        await expect
            .poll(async () => (await current(page)).state, { message: `${screen} state ${state}`, timeout })
            .toBe(state)
    // the step slide is 500 ms; act on the screen once it rests
    await page.waitForTimeout(600)
}

const footer = (page: Page) => page.locator('[data-setup-footer]')
/** The panel of the screen on show (a leaving screen keeps its inert panel for 500 ms). */
const panelOf = (page: Page) => page.locator('[data-setup-slide]:not([aria-hidden]) [data-setup-panel]')
/** The open DS drawer (Support keeps a closed dialog mounted). */
const drawer = (page: Page) => page.locator('[role="dialog"][data-vaul-drawer]')
const primary = (page: Page, name: string) => footer(page).getByRole('button', { name, exact: true })
const goBack = (page: Page, locale: Locale = 'en') =>
    page.locator('[data-setup-top-bar]').getByRole('button', { name: copy(locale, 'setup.navigation.goBack') })

function expectNoUsernameInUrl(page: Page, username: string) {
    expect(page.url(), 'the username never rides in the URL (C-33)').not.toContain(username)
}

// ---------------------------------------------------------------------------------------------------------------
// The journey, a screen at a time
// ---------------------------------------------------------------------------------------------------------------

async function landingToUsername(page: Page, locale: Locale) {
    const t = (key: string, values?: Record<string, string>) => copy(locale, key, values)
    await expectScreen(page, 'landing', 'default', 30_000)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('setupRedesign.landing.title'))
    await primary(page, t('setupRedesign.landing.cta')).click()

    await expectScreen(page, 'advantage-fees', 'default')
    await expect(page).toHaveURL(/screen=advantage-fees/)
    await primary(page, t('setupRedesign.common.continue')).click()

    await expectScreen(page, 'advantage-card', 'default')
    await primary(page, t('setupRedesign.common.continue')).click()

    // 07: the geo suggestion (AR) prefills the residence, the nationality reads "the same"
    await expectScreen(page, 'residence', 'default')
    await expect(panelOf(page)).toContainText('Argentina')
    // owner ruling 17 Nov: "My residence is in [X], my nationality is [Y]."
    await expect(panelOf(page)).toContainText(t('setupRedesign.residence.sentence').split(',')[0].trim())
    await primary(page, t('setupRedesign.common.continue')).click()

    // 08: Argentina offers a bank and QR; pick both, then Continue
    await expectScreen(page, 'payment-plan', 'default')
    const panel = panelOf(page)
    // owner ruling 17 Nov: the one info line under the choice, in default and filled
    const changeLater = panel.getByText(t('setupRedesign.plan.changeLater'), { exact: true })
    await expect(changeLater).toBeVisible()
    await panel
        .getByRole('button', { name: t('setupRedesign.plan.choose') })
        .first()
        .click()
    await drawer(page).getByText(t('setupRedesign.plan.fundBank'), { exact: true }).click()
    await panel
        .getByRole('button', { name: t('setupRedesign.plan.choose') })
        .first()
        .click()
    await drawer(page).getByText(t('setupRedesign.plan.payQr'), { exact: true }).click()
    await expectScreen(page, 'payment-plan', 'filled')
    await expect(changeLater).toBeVisible()
    await primary(page, t('setupRedesign.common.continue')).click()

    await expectScreen(page, 'signup')
}

/**
 * Steps to 02 from wherever an entry lands (an invite or claim link may skip the landing as dev's entry rules
 * decide): the same taps as landingToUsername, without asserting the order.
 */
async function anyEntryToUsername(page: Page, locale: Locale) {
    const t = (key: string) => copy(locale, key)
    await expect.poll(async () => (await current(page)).screen, { timeout: 30_000 }).not.toBeNull()
    for (let step = 0; step < 8; step++) {
        const { screen } = await current(page)
        if (screen === 'signup') return
        await page.waitForTimeout(600)
        if (screen === 'landing') await primary(page, t('setupRedesign.landing.cta')).click()
        else if (screen === 'payment-plan') {
            const panel = panelOf(page)
            await panel
                .getByRole('button', { name: t('setupRedesign.plan.choose') })
                .first()
                .click()
            await drawer(page).getByText(t('setupRedesign.plan.fundBank'), { exact: true }).click()
            await panel
                .getByRole('button', { name: t('setupRedesign.plan.choose') })
                .first()
                .click()
            await drawer(page).getByText(t('setupRedesign.plan.payQr'), { exact: true }).click()
            await primary(page, t('setupRedesign.common.continue')).click()
        } else await primary(page, t('setupRedesign.common.continue')).click()
        await expect.poll(async () => (await current(page)).screen).not.toBe(screen)
    }
    await expectScreen(page, 'signup')
}

async function claimUsername(page: Page, locale: Locale, name: string) {
    const t = (key: string, values?: Record<string, string>) => copy(locale, key, values)
    const field = page.getByRole('textbox', { name: t('setupRedesign.username.fieldAria') })
    await field.fill(name)
    await expectScreen(page, 'signup', 'available')
    await primary(page, t('setupRedesign.username.ctaNamed', { name })).click()
}

async function inviteSkip(page: Page, locale: Locale) {
    await expectScreen(page, 'invite', 'default')
    await footer(page)
        .getByRole('button', { name: copy(locale, 'setupRedesign.common.skip'), exact: true })
        .click()
}

async function createPasskey(page: Page, locale: Locale) {
    await expectScreen(page, 'passkey', 'default')
    await primary(page, copy(locale, 'setupRedesign.passkey.s1.cta')).click()
}

async function emailToFinal(page: Page, locale: Locale, email: string) {
    const t = (key: string) => copy(locale, key)
    await expectScreen(page, 'notification-email', 'default', 30_000)
    await expect(goBack(page, locale), 'Back is hidden from Email on (the lock)').toHaveCount(0)
    await page.getByRole('textbox', { name: t('setupRedesign.email.label') }).fill(email)
    await expectScreen(page, 'notification-email', 'filled')
    await primary(page, t('setupRedesign.common.continue')).click()

    await expectScreen(page, 'notification-permission', 'default')
    await footer(page)
        .getByRole('button', { name: t('setupRedesign.common.notNow'), exact: true })
        .click()

    await expectScreen(page, 'advantage-control', 'default')
}

async function confirmAndCelebrate(
    page: Page,
    locale: Locale,
    state: 'default' | 'claim-link' | 'verify-offer' = 'default'
) {
    if (!STUB_BUNDLER) {
        test.info().annotations.push({ type: 'not checked', description: '11 → 12: no stub bundler in this build' })
        return false
    }
    await primary(page, copy(locale, 'setupRedesign.final.cta')).click()
    await expectScreen(page, 'advantage-control', state, 45_000)
    const title = copy(locale, state === 'claim-link' ? 'setupRedesign.done.claimTitle' : 'setupRedesign.done.title')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    // owner ruling 17 Nov: the whistling peanut (waving-chill), not the cheering one
    await expect(page.locator('[data-mascot-pose="waving-chill"]')).toHaveCount(1)
    await expect(page.locator('[data-mascot-pose="cheering"]')).toHaveCount(0)
    return true
}

/**
 * Answers PostHog's flag request with the verify start on, as the rollback switch is set in production (signup v7).
 * A build without a PostHog key never asks, so the Verify start stays off and the test says so instead of passing.
 */
async function verifyStartFlagOn(context: BrowserContext) {
    const flag = 'signup-verify-start'
    await context.route(/\/relay\/|posthog\.com/, async (route) => {
        if (/\/(flags|decide)\b/.test(new URL(route.request().url()).pathname))
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    featureFlags: { [flag]: true },
                    flags: { [flag]: { key: flag, enabled: true } },
                    featureFlagPayloads: {},
                }),
            })
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' })
    })
}

/** Every screen from Landing to 12, for a default (organic) sign-up. */
async function organicSignupToCelebration(
    page: Page,
    context: BrowserContext,
    baseURL: string,
    username: string,
    state: 'default' | 'verify-offer' = 'verify-offer'
) {
    await addAuthenticator(page)
    await openSetup(page, context, baseURL)
    await landingToUsername(page, 'en')
    await claimUsername(page, 'en', username)
    await inviteSkip(page, 'en')
    await createPasskey(page, 'en')
    await emailToFinal(page, 'en', `${username}@gmail.com`)
    return confirmAndCelebrate(page, 'en', state)
}

/** The three POSTs that turn a reserved name into an account, in order, for this username. */
function expectRegistered(username: string) {
    const reservation = stub.seen('POST', '/users/username/reservations')
    expect(reservation.map((r) => (r.body as { username?: string })?.username)).toContain(username)
    const options = stub.seen('POST', '/passkeys/register/options')
    expect(options.map((r) => (r.body as { username?: string })?.username)).toContain(`${username}.peanut.wallet`)
    expect(stub.seen('POST', '/passkeys/register/verify')).toHaveLength(1)
}

// ---------------------------------------------------------------------------------------------------------------
// Journeys
// ---------------------------------------------------------------------------------------------------------------

test.describe('sign-up redesign journeys', () => {
    test.describe.configure({ mode: 'default', retries: 0, timeout: 180_000 })

    test.beforeEach(() => stub.reset())
    test.afterEach(async ({ page }, testInfo) => {
        // what the stub saw and could not answer is the first thing to read when a journey fails
        await testInfo.attach('stub-requests.json', {
            body: JSON.stringify(
                {
                    endedOn: page.url(),
                    shown: await current(page).catch(() => null),
                    unhandled: stub.unhandled,
                    requests: stub.requests.map((r) => `${r.origin} ${r.method} ${r.path}`),
                },
                null,
                2
            ),
            contentType: 'application/json',
        })
    })

    for (const run of [
        { locale: 'en' as const, viewport: { width: 390, height: 844 } },
        { locale: 'es-AR' as const, viewport: { width: 390, height: 844 } },
        { locale: 'en' as const, viewport: { width: 320, height: 568 } },
    ]) {
        test.describe(`${run.locale} ${run.viewport.width}x${run.viewport.height}`, () => {
            test.use({ locale: run.locale, viewport: run.viewport })

            test('fresh sign-up: landing to celebration, one account, residence sent once after registration', async ({
                page,
                context,
                baseURL,
            }) => {
                const username = run.locale === 'en' ? 'luckyotter' : 'tigrefeliz'
                await addAuthenticator(page)
                await openSetup(page, context, baseURL!)
                await landingToUsername(page, run.locale)
                expect(stub.seen('POST', '/update-user'), 'no answer leaves before the account exists').toHaveLength(0)
                await claimUsername(page, run.locale, username)
                expectNoUsernameInUrl(page, username)
                await inviteSkip(page, run.locale)
                await createPasskey(page, run.locale)
                expectNoUsernameInUrl(page, username)
                await emailToFinal(page, run.locale, `${username}@gmail.com`)
                expectRegistered(username)
                const residenceUpdates = stub
                    .seen('POST', '/update-user')
                    .filter((r) => 'residenceCountry' in ((r.body as object) ?? {}))
                expect(residenceUpdates, 'P3-35: the residence is sent once, after registration').toHaveLength(1)
                expect(residenceUpdates[0].body).toMatchObject({ residenceCountry: 'AR' })
                expect(
                    stub
                        .seen('POST', '/update-user')
                        .some((r) => (r.body as { email?: string })?.email === `${username}@gmail.com`)
                ).toBe(true)
                if (await confirmAndCelebrate(page, run.locale))
                    expect(
                        stub.seen('RPC', /eth_sendUserOperation/),
                        'P4-50: one account-completion UserOp'
                    ).toHaveLength(1)
            })
        })
    }

    test.describe('en 390x844', () => {
        test.use({ locale: 'en', viewport: { width: 390, height: 844 } })

        test('passkey cancelled, then retried: inline callout, Create passkey works again (C-60)', async ({
            page,
            context,
            baseURL,
        }) => {
            const authenticator = await addAuthenticator(page, false)
            await openSetup(page, context, baseURL!)
            await landingToUsername(page, 'en')
            await claimUsername(page, 'en', 'mellowfox')
            await inviteSkip(page, 'en')
            await createPasskey(page, 'en')
            await expectScreen(page, 'passkey', 'error-inline')
            await expect(page.getByTestId('passkey-inline-error')).toHaveText(
                copy('en', 'setupRedesign.passkey.cancelled')
            )
            await expect(primary(page, copy('en', 'setupRedesign.passkey.s1.cta'))).toBeEnabled()
            expect(stub.seen('POST', '/passkeys/register/verify')).toHaveLength(0)

            await authenticator.cdp.send('WebAuthn.setUserVerified', {
                authenticatorId: authenticator.id,
                isUserVerified: true,
            })
            await primary(page, copy('en', 'setupRedesign.passkey.s1.cta')).click()
            await expectScreen(page, 'notification-email', 'default', 30_000)
            expect(stub.seen('POST', '/passkeys/register/options')).toHaveLength(2)
            expect(stub.seen('POST', '/passkeys/register/verify')).toHaveLength(1)
        })

        test('username taken at the passkey step: taken screen, back to 02 on the name, a new name goes on (C-61)', async ({
            page,
            context,
            baseURL,
        }) => {
            await addAuthenticator(page)
            stub.takenAtPasskey.add('mellowfox')
            await openSetup(page, context, baseURL!)
            await landingToUsername(page, 'en')
            await claimUsername(page, 'en', 'mellowfox')
            await inviteSkip(page, 'en')
            await createPasskey(page, 'en')
            await expectScreen(page, 'passkey', 'taken')
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(
                copy('en', 'setupRedesign.passkey.takenTitle', { name: '@mellowfox' })
            )
            expect(stub.seen('POST', '/passkeys/register/options'), 'no ceremony for a taken name').toHaveLength(0)

            await primary(page, copy('en', 'setupRedesign.passkey.takenCta')).click()
            await expectScreen(page, 'signup', 'taken')
            const field = page.getByRole('textbox', { name: copy('en', 'setupRedesign.username.fieldAria') })
            await expect(field).toHaveValue('mellowfox')
            await expect(field).toBeFocused()

            await field.fill('mellowfox7')
            await expectScreen(page, 'signup', 'available')
            await primary(page, copy('en', 'setupRedesign.username.ctaNamed', { name: 'mellowfox7' })).click()
            await expectScreen(page, 'invite', 'default')
            await inviteSkip(page, 'en')
            await expectScreen(page, 'passkey', 'default')
        })

        test('invite link: Username goes straight to Passkey, Invite never renders (P2-07)', async ({
            page,
            context,
            baseURL,
        }) => {
            await addAuthenticator(page)
            await openSetup(page, context, baseURL!, '/setup?code=fulano')
            const seen = new Set<string>()
            const watch = setInterval(
                () =>
                    void current(page)
                        .then((c) => c.screen && seen.add(c.screen))
                        .catch(() => {}),
                100
            )
            try {
                await anyEntryToUsername(page, 'en')
                await claimUsername(page, 'en', 'luckyotter')
                await expectScreen(page, 'passkey', 'default')
                // Back from Passkey goes to Username when Invite is hidden (C-62)
                await goBack(page).click()
                await expectScreen(page, 'signup')
            } finally {
                clearInterval(watch)
            }
            expect([...seen]).not.toContain('invite')
        })

        test('claim link: the last screen carries the claim copy and the app returns to the link (P4-57)', async ({
            page,
            context,
            baseURL,
        }) => {
            await addAuthenticator(page)
            const claim = '/claim?c=42161&v=v4.3&i=7#p=e2e'
            await openSetup(page, context, baseURL!, `/setup?redirect_uri=${encodeURIComponent(claim)}`)
            await anyEntryToUsername(page, 'en')
            await claimUsername(page, 'en', 'luckyotter')
            await inviteSkip(page, 'en')
            await createPasskey(page, 'en')
            await emailToFinal(page, 'en', 'luckyotter@gmail.com')
            if (!(await confirmAndCelebrate(page, 'en', 'claim-link'))) return
            await expect(page.getByText(copy('en', 'setupRedesign.done.claimGoing'))).toBeVisible()
            await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/claim')
        })

        test.describe('12 Celebration and Verify start (signup v7, flag signup-verify-start on)', () => {
            const verifyNow = (page: Page) => primary(page, copy('en', 'setupRedesign.verifyStart.verifyNow'))
            const remindLater = (page: Page) =>
                page.getByRole('button', { name: copy('en', 'setupRedesign.verifyStart.remindLater') })
            const toVerifyStart = async (page: Page) => {
                await verifyNow(page).click()
                await expectScreen(page, 'advantage-control', 'verify-start')
                await expect(page.getByRole('heading', { level: 1 })).toHaveText(
                    copy('en', 'setupRedesign.verifyStart.title')
                )
                await expect(page.getByText(copy('en', 'setupRedesign.verifyStart.sub'))).toBeVisible()
                await expect(page.getByTestId('setup-redesign-verify-steps').getByRole('listitem')).toHaveCount(2)
            }

            test('Celebration: Verify now and Remind me later, no redirect; Remind me later opens Home', async ({
                page,
                context,
                baseURL,
            }) => {
                await verifyStartFlagOn(context)
                if (!(await organicSignupToCelebration(page, context, baseURL!, 'luckyotter'))) return
                await expect(verifyNow(page)).toBeVisible()
                await expect(remindLater(page)).toBeVisible()
                // the 4.5 s redirect is gone on this path
                await page.waitForTimeout(6000)
                expect(new URL(page.url()).pathname).toBe('/setup')
                await remindLater(page).click()
                await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/home')
            })

            test('Celebration → Verify start → Verify now opens the first question, past the /verify overview', async ({
                page,
                context,
                baseURL,
            }) => {
                await verifyStartFlagOn(context)
                if (!(await organicSignupToCelebration(page, context, baseURL!, 'luckyotter'))) return
                await toVerifyStart(page)
                await verifyNow(page).click()
                // /verify for a Smart Paperwork Verification user; the legacy start modal otherwise (unit tests cover it)
                await expect
                    .poll(
                        async () => {
                            const url = new URL(page.url())
                            if (url.pathname === '/verify') return url.searchParams.get('skipOverview') === 'true'
                            return (await page.getByRole('dialog').count()) > 0
                        },
                        { timeout: 15_000 }
                    )
                    .toBe(true)
                await expect(page.getByTestId('verify-steps')).toHaveCount(0)
            })

            test('Verify start: Remind me later opens Home', async ({ page, context, baseURL }) => {
                await verifyStartFlagOn(context)
                if (!(await organicSignupToCelebration(page, context, baseURL!, 'luckyotter'))) return
                await toVerifyStart(page)
                await remindLater(page).click()
                await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/home')
            })

            test('a claim-link sign-up keeps its copy and the auto-redirect', async ({ page, context, baseURL }) => {
                await verifyStartFlagOn(context)
                await addAuthenticator(page)
                const claim = '/claim?c=42161&v=v4.3&i=7#p=e2e'
                await openSetup(page, context, baseURL!, `/setup?redirect_uri=${encodeURIComponent(claim)}`)
                await anyEntryToUsername(page, 'en')
                await claimUsername(page, 'en', 'luckyotter')
                await inviteSkip(page, 'en')
                await createPasskey(page, 'en')
                await emailToFinal(page, 'en', 'luckyotter@gmail.com')
                if (!(await confirmAndCelebrate(page, 'en', 'claim-link'))) return
                await expect(remindLater(page)).toHaveCount(0)
                await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/claim')
            })

            test("flag off: dev's Celebration with no buttons leaves for Home on its own", async ({
                page,
                context,
                baseURL,
            }) => {
                if (!(await organicSignupToCelebration(page, context, baseURL!, 'luckyotter', 'default'))) return
                await expect(remindLater(page)).toHaveCount(0)
                await expect(page.getByText(copy('en', 'setupRedesign.done.going'))).toBeVisible()
                await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/home')
            })
        })

        test('resume after a refresh: 08 keeps residence and plan, 03 keeps the username (P3-35, C-62)', async ({
            page,
            context,
            baseURL,
        }) => {
            await addAuthenticator(page)
            await openSetup(page, context, baseURL!)
            await landingToUsername(page, 'en')
            await page.reload({ waitUntil: 'domcontentloaded' })
            await expectScreen(page, 'signup', undefined, 60_000)
            await goBack(page).click()
            await expectScreen(page, 'payment-plan', 'filled')

            await primary(page, copy('en', 'setupRedesign.common.continue')).click()
            await expectScreen(page, 'signup')
            await claimUsername(page, 'en', 'luckyotter')
            await inviteSkip(page, 'en')
            await expectScreen(page, 'passkey', 'default')
            await page.reload({ waitUntil: 'domcontentloaded' })
            await expectScreen(page, 'passkey', 'default', 60_000)
            await expect(page.locator('[data-setup-art-layer]').getByText('@luckyotter')).toBeVisible()
            expectNoUsernameInUrl(page, 'luckyotter')
        })

        test('a draft older than 30 days does not resume (C-62)', async ({ page, context, baseURL }) => {
            await page.addInitScript(() => {
                if (window.sessionStorage.getItem('e2e-draft-seeded')) return
                window.sessionStorage.setItem('e2e-draft-seeded', '1')
                const old = Date.now() - 31 * 24 * 60 * 60 * 1000
                window.localStorage.setItem(
                    'peanut:signupDraft:v2',
                    JSON.stringify({
                        version: 2,
                        savedAt: old,
                        screenId: 'passkey',
                        answers: { username: 'luckyotter', inviteSelection: '' },
                    })
                )
            })
            await openSetup(page, context, baseURL!)
            await expectScreen(page, 'landing', 'default', 30_000)
        })

        test('back lock: from Email on, neither Back nor the browser returns to Passkey', async ({
            page,
            context,
            baseURL,
        }) => {
            await addAuthenticator(page)
            await openSetup(page, context, baseURL!)
            await landingToUsername(page, 'en')
            await claimUsername(page, 'en', 'luckyotter')
            await inviteSkip(page, 'en')
            await createPasskey(page, 'en')
            await expectScreen(page, 'notification-email', 'default', 30_000)
            await expect(goBack(page)).toHaveCount(0)
            await page.goBack()
            await page.waitForTimeout(1000)
            expect((await current(page)).screen).toBe('notification-email')
            await page
                .getByRole('textbox', { name: copy('en', 'setupRedesign.email.label') })
                .fill('luckyotter@gmail.com')
            await primary(page, copy('en', 'setupRedesign.common.continue')).click()
            await expectScreen(page, 'notification-permission', 'default')
            await goBack(page).click()
            await expectScreen(page, 'notification-email')
            await expect(goBack(page)).toHaveCount(0)
        })

        test('Back from Passkey returns to Invite with the field empty; Back from Invite returns to Username (P2-03, C-62)', async ({
            page,
            context,
            baseURL,
        }) => {
            await addAuthenticator(page)
            await openSetup(page, context, baseURL!)
            await landingToUsername(page, 'en')
            await claimUsername(page, 'en', 'luckyotter')
            await inviteSkip(page, 'en')
            await expectScreen(page, 'passkey', 'default')
            await goBack(page).click()
            await expectScreen(page, 'invite', 'default')
            await expect(panelOf(page).locator('input').first()).toHaveValue('')
            await goBack(page).click()
            await expectScreen(page, 'signup', 'available')
            await expect(
                page.getByRole('textbox', { name: copy('en', 'setupRedesign.username.fieldAria') })
            ).toHaveValue('luckyotter')
        })

        test('reload on Email resumes on Email with the typed address (P4-03)', async ({ page, context, baseURL }) => {
            await addAuthenticator(page)
            await openSetup(page, context, baseURL!)
            await landingToUsername(page, 'en')
            await claimUsername(page, 'en', 'luckyotter')
            await inviteSkip(page, 'en')
            await createPasskey(page, 'en')
            await expectScreen(page, 'notification-email', 'default', 30_000)
            const field = page.getByRole('textbox', { name: copy('en', 'setupRedesign.email.label') })
            await field.fill('luckyotter@gmail.com')
            await primary(page, copy('en', 'setupRedesign.common.continue')).click()
            await expectScreen(page, 'notification-permission', 'default')
            await page.reload({ waitUntil: 'domcontentloaded' })
            await expectScreen(page, 'notification-permission', 'default', 60_000)
            await goBack(page).click()
            await expectScreen(page, 'notification-email', 'filled')
            await expect(field).toHaveValue('luckyotter@gmail.com')
        })

        test('demo reviewer username: no check, no reservation, no passkey; the app opens on the last step', async ({
            page,
            context,
            baseURL,
        }) => {
            await openSetup(page, context, baseURL!)
            await landingToUsername(page, 'en')
            const field = page.getByRole('textbox', { name: copy('en', 'setupRedesign.username.fieldAria') })
            await field.fill('demo')
            await expectScreen(page, 'signup', 'available')
            await primary(page, copy('en', 'setupRedesign.username.ctaNamed', { name: 'demo' })).click()
            await expectScreen(page, 'advantage-control', undefined, 30_000)
            expect(stub.seen('HEAD', '/users/username/demo')).toHaveLength(0)
            expect(stub.seen('GET', '/users/username/demo')).toHaveLength(0)
            expect(stub.seen('POST', '/users/username/reservations')).toHaveLength(0)
            expect(stub.seen('POST', /^\/passkeys\//)).toHaveLength(0)
        })

        test('log-in fails twice with no passkey on the device: the 2nd failure shows the recovery link (P1-55)', async ({
            page,
            context,
            baseURL,
        }) => {
            await addAuthenticator(page)
            await openSetup(page, context, baseURL!)
            await expectScreen(page, 'landing', 'default', 30_000)
            const logIn = footer(page).getByRole('button', {
                name: copy('en', 'setupRedesign.landing.loginBtn'),
                exact: true,
            })

            await logIn.click()
            await expect.poll(() => stub.seen('POST', '/passkeys/login/options').length, { timeout: 15_000 }).toBe(1)
            await expect(logIn).toBeEnabled({ timeout: 15_000 })
            await expect(
                page.getByTestId('landing-recovery-link'),
                'the first cancel on the web shows no link'
            ).toHaveCount(0)
            expect((await current(page)).state).toBe('default')

            await logIn.click()
            await expectScreen(page, 'landing', 'login-failed', 15_000)
            await expect(page.getByTestId('landing-recovery-link')).toHaveText(
                copy('en', 'setupRedesign.landing.recover')
            )
            await expect(drawer(page)).toBeVisible()
            expect(stub.seen('POST', '/passkeys/login/options')).toHaveLength(2)
            expect(stub.seen('POST', /^\/passkeys\/register\//)).toHaveLength(0)
        })

        for (const gap of [0, 200, 400]) {
            test(`a double tap ${gap} ms apart on 01, 05 and 06 goes exactly one screen each (R2-01)`, async ({
                page,
                context,
                baseURL,
            }) => {
                await openSetup(page, context, baseURL!)
                await expectScreen(page, 'landing', 'default', 30_000)
                for (const [from, to] of [
                    ['landing', 'advantage-fees'],
                    ['advantage-fees', 'advantage-card'],
                    ['advantage-card', 'residence'],
                ] as const) {
                    expect((await current(page)).screen).toBe(from)
                    // the primary sits at the same pixel on every screen: the second tap lands on the next screen's button
                    const box = (await footer(page).getByRole('button').first().boundingBox())!
                    const x = box.x + box.width / 2
                    const y = box.y + box.height / 2
                    // the gap runs from the first tap's start: a tap itself takes 50-100 ms on a busy box, and a
                    // second tap past the 500 ms step is a deliberate tap that should step again
                    const start = Date.now()
                    await page.touchscreen.tap(x, y)
                    const rest = gap - (Date.now() - start)
                    if (rest > 0) await page.waitForTimeout(rest)
                    await page.touchscreen.tap(x, y)
                    await expect(page.locator('[data-setup-shell]')).not.toHaveAttribute('data-nav-locked')
                    await page.waitForTimeout(300)
                    expect((await current(page)).screen, `one tap gesture, one step from ${from}`).toBe(to)
                }
            })
        }

        for (const viewport of [
            { width: 390, height: 844, keyboard: 336 },
            { width: 320, height: 568, keyboard: 260 },
        ]) {
            test(`keyboard open on 02 at ${viewport.width}: the field and its help line stay above the button (R2-02)`, async ({
                page,
                context,
                baseURL,
            }) => {
                await page.setViewportSize({ width: viewport.width, height: viewport.height })
                await openSetup(page, context, baseURL!)
                await landingToUsername(page, 'en')
                const field = page.getByRole('textbox', { name: copy('en', 'setupRedesign.username.fieldAria') })
                await field.focus()
                await field.fill('mellowfox')
                await expectScreen(page, 'signup', 'available')
                // what the native apps do for the keyboard (adjustResize): the page gets shorter
                await page.setViewportSize({ width: viewport.width, height: viewport.height - viewport.keyboard })
                await expect(page.locator('[data-setup-shell]')).toHaveAttribute('data-keyboard', '')
                await page.waitForTimeout(900)
                const visible = viewport.height - viewport.keyboard
                const button = (await footer(page).getByRole('button').first().boundingBox())!
                const input = (await field.boundingBox())!
                const help = (await panelOf(page)
                    .getByText(copy('en', 'setupRedesign.username.available'), { exact: true })
                    .first()
                    .boundingBox())!
                expect(input.y, 'the field is on screen').toBeGreaterThanOrEqual(0)
                expect(input.y + input.height, 'the field ends above the button').toBeLessThanOrEqual(button.y)
                expect(help.y + help.height, 'the help line ends above the button').toBeLessThanOrEqual(button.y)
                expect(button.y + button.height, 'the button is above the keyboard').toBeLessThanOrEqual(visible)
            })
        }

        test.describe('on a desktop browser (mouse, no touch)', () => {
            test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 })

            test('a desktop window made shorter with the field focused is not a keyboard: the stage stays', async ({
                page,
                context,
                baseURL,
            }) => {
                await page.setViewportSize({ width: 1440, height: 900 })
                await openSetup(page, context, baseURL!)
                await landingToUsername(page, 'en')
                const field = page.getByRole('textbox', { name: copy('en', 'setupRedesign.username.fieldAria') })
                await field.focus()
                await page.setViewportSize({ width: 1440, height: 740 })
                await page.waitForTimeout(900)
                const shell = page.locator('[data-setup-shell]')
                await expect(shell).not.toHaveAttribute('data-keyboard')
                await expect(shell).not.toHaveAttribute('data-fold')
                await expect(page.locator('[data-setup-hero]')).toBeVisible()
            })
        })

        test('slow network on the username check: the button stays off until the answer, then turns on', async ({
            page,
            context,
            baseURL,
        }) => {
            stub.delays.set('HEAD /users/username/mellowfox', 4000)
            await openSetup(page, context, baseURL!)
            await landingToUsername(page, 'en')
            const field = page.getByRole('textbox', { name: copy('en', 'setupRedesign.username.fieldAria') })
            const cta = footer(page).getByRole('button').first()
            await field.fill('mellowfox')
            await expect.poll(() => stub.seen('HEAD', '/users/username/mellowfox').length, { timeout: 5_000 }).toBe(1)
            await page.waitForTimeout(2000)
            expect((await current(page)).state, 'still checking two seconds into a four-second answer').toBe('typing')
            await expect(cta).toBeDisabled()
            await expectScreen(page, 'signup', 'available', 10_000)
            await expect(
                primary(page, copy('en', 'setupRedesign.username.ctaNamed', { name: 'mellowfox' }))
            ).toBeEnabled()
        })
    })
})
