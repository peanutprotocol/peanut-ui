/** @jest-environment jsdom */
/**
 * 07 Residence (`residence`), contract P3 § 3: the sentence view, the drawers, the refused-passport callout, the
 * compare view and the save. Written from the contract before the screen exists; the copy keys are the contract's
 * (§ 3.4), read from the real catalogs.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import posthog from 'posthog-js'
import type { KycIntents } from '@/hooks/useKycIntents'
import type { AppLocale } from '@/i18n/app/config'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { __resetSignupSavesForTests } from '@/features/setup/saveSignupAnswers'
import { signupControls } from '@/test-utils/signup-controls'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'
import { buildResidenceCountryOptions } from '@/utils/residence-options'
import { ResidenceScreen } from '../ResidenceScreen'
import {
    copy,
    copyRx,
    type FlowSeed,
    footer,
    rawCopy,
    renderRedesign,
    setupState,
    textMatch,
    textRx,
    visibleText,
    openDialog,
} from '../../Accounts/__tests__/redesignHarness'

// ---- boundaries -------------------------------------------------------------------------------------------

const mockHandleNext = jest.fn()
let mockIsLoading = false
jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: mockIsLoading }),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), setPersonProperties: jest.fn(), register: jest.fn() },
}))
jest.mock('framer-motion', () => require('../../Accounts/__tests__/framerMock').framerMotionForShell())
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: {
        loadAnimation: () => ({
            totalFrames: 20,
            frameRate: 30,
            addEventListener: jest.fn(),
            destroy: jest.fn(),
            goToAndStop: jest.fn(),
        }),
    },
}))

let mockUserId: string | null = 'user-1'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUserId ? { user: { userId: mockUserId } } : null }),
}))
// Never settles: the step must move on without waiting for the save.
const mockUpdateUserById = jest.fn((_payload: Record<string, unknown>) => new Promise(() => undefined))
jest.mock('@/app/actions/users', () => ({
    updateUserById: (payload: Record<string, unknown>) => mockUpdateUserById(payload),
}))

let mockEdgeCountry: string | null = null
let mockIpCountry: string | null = null
let mockEdgeSettled = true
jest.mock('@/features/setup/useSetupCountrySignals', () => ({
    useSetupCountrySignals: () => ({
        vercelIpCountry: mockEdgeCountry,
        edgeSettled: mockEdgeSettled,
        ipCountry: mockIpCountry,
        deviceLanguage: 'en-us',
        browserLanguages: ['en-us'],
        deviceTimezone: 'UTC',
        collectedAt: '2026-11-16T10:00:00Z',
    }),
}))

let mockSets: unknown
let mockSetsSettled = true
jest.mock('@/hooks/useResidenceRestrictionSets', () => {
    const actual = jest.requireActual('@/hooks/useResidenceRestrictionSets')
    const fixture = () => jest.requireActual('@/test-utils/residenceRestrictions.fixture').RESIDENCE_RESTRICTION_SETS
    return {
        ...actual,
        // mockSets: undefined = the fixture, null = the read failed (settled with no lists)
        useResidenceRestrictionSetsWithStatus: () => ({
            sets: mockSetsSettled ? (mockSets === undefined ? fixture() : mockSets) : null,
            settled: mockSetsSettled,
        }),
        useResidenceRestrictionSets: () => (mockSetsSettled ? (mockSets === undefined ? fixture() : mockSets) : null),
    }
})

// Per country: served intents (undefined = the read failed) and whether the read settled.
let mockIntents: Record<string, { intents?: KycIntents; settled: boolean }> = {}
jest.mock('@/hooks/useKycIntents', () => ({
    useKycIntents: (country: string) =>
        mockIntents[country] ?? {
            intents: jest.requireActual('@/test-utils/kycIntents.fixture').KYC_INTENTS_BY_COUNTRY[country],
            settled: true,
        },
}))

// ---- helpers ------------------------------------------------------------------------------------------------

const capture = posthog.capture as jest.Mock
const controls = () => signupControls(capture)
const events = (name: string) => capture.mock.calls.filter(([event]) => event === name).map(([, props]) => props)
const OUTCOMES = [
    ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN,
    ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN,
    ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN,
]

const K = 'setupRedesign.residence'
/** "Tap a country to change it.": on the screen only in info-line option c (TASK-25063, Kush picks). */
const HINT = { en: copy(`${K}.hint`), 'es-AR': copy(`${K}.hint`, {}, 'es-AR') } as const
const labelOf = (iso2: string, locale: AppLocale = 'en') =>
    buildResidenceCountryOptions(locale).find((o) => o.value === iso2)!.label

/** The sentence with both pill labels filled in, as visible text (slot tags or placeholders). */
function sentence(residence: string, nationality: string, locale: AppLocale = 'en') {
    return rawCopy(`${K}.sentence`, locale)
        .replace(/<residence><\/residence>|\{residence\}/, residence)
        .replace(/<nationality><\/nationality>|\{nationality\}/, nationality)
        .replace(/<\/?nw>/g, '')
        .replace(/ /g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

const intents = (partial: Partial<KycIntents>): KycIntents => ({
    qr: { available: true },
    local: { available: false, reason: 'local_residence_unsupported' },
    card: { available: true },
    bank: { available: true, currencies: ['USD', 'EUR'] },
    ...partial,
})
const orList = (codes: string[], locale: AppLocale = 'en') =>
    new Intl.ListFormat(locale === 'en' ? 'en-GB' : locale, { type: 'disjunction' }).format(codes)

function render(seed: FlowSeed = {}, options: { locale?: AppLocale; onFinish?: () => Promise<void> } = {}) {
    const view = renderRedesign(<ResidenceScreen />, {
        screenId: 'residence',
        seed,
        locale: options.locale,
        onFinish: options.onFinish,
        showBackButton: true,
        onBack: () => {
            dispatchBackPress()
        },
    })
    const residencePill = () => screen.getByTestId('setup-residence-country')
    const nationalityPill = () => screen.getByTestId('setup-nationality-country')
    const continueButton = () => within(footer(view.container)!).getByTestId('setup-residence-continue')
    const selectButton = (iso2: string) => within(footer(view.container)!).getByTestId(`setup-residence-select-${iso2}`)
    const column = (iso2: string) => screen.getByTestId(`setup-redesign-residence-column-${iso2}`)
    const items = (iso2: string) =>
        within(column(iso2))
            .queryAllByRole('listitem')
            .map((li) => visibleText(li))
    return { ...view, residencePill, nationalityPill, continueButton, selectButton, column, items }
}

beforeEach(() => {
    jest.clearAllMocks()
    resetBackHandlersForTests()
    __resetSignupSavesForTests()
    mockIsLoading = false
    mockUserId = 'user-1'
    mockEdgeCountry = null
    mockIpCountry = null
    mockEdgeSettled = true
    mockSets = undefined
    mockSetsSettled = true
    mockIntents = {}
})

// ---- sentence view -----------------------------------------------------------------------------------------

describe('07 Residence: sentence view', () => {
    it('P3-11 prefills the residence from a geo suggestion, nationality reads the same country without a flag, no auto-advance', async () => {
        mockIpCountry = 'AR'
        const view = render()
        await waitFor(() => expect(view.flow().residenceCountry).toBe('AR'))
        expect(setupState(view.container)).toBe('default')
        const residence = view.residencePill()
        expect(visibleText(residence)).toBe(labelOf('AR'))
        expect(residence.querySelector('img[src*="/flags/ar"]')).not.toBeNull()
        const nationality = view.nationalityPill()
        expect(visibleText(nationality)).toBe(labelOf('AR'))
        expect(nationality.querySelector('img')).toBeNull()
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('P3-12 with no suggestion and nothing stored: Choose with the question mark, state empty, Continue disabled', () => {
        const view = render()
        expect(setupState(view.container)).toBe('empty')
        expect(visibleText(view.residencePill())).toBe(copy(`${K}.choose`))
        expect(view.residencePill().querySelector('img[src*="/flags/"]')).toBeNull()
        expect(view.continueButton()).toBeDisabled()
        fireEvent.click(view.continueButton())
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(view.flow().residenceCountry).toBe('')
    })

    it('P3-13 a stored residence is not overwritten by a suggestion that arrives later', () => {
        mockEdgeSettled = false
        const view = render({ residenceCountry: 'DE' })
        mockEdgeSettled = true
        mockEdgeCountry = 'AR'
        view.rerenderSame()
        expect(view.flow().residenceCountry).toBe('DE')
        expect(visibleText(view.residencePill())).toBe(labelOf('DE'))
    })

    it('P3-13 the Vercel country beats a differing IP country, and the IP waits for the edge lookup', async () => {
        mockEdgeCountry = 'AR'
        mockIpCountry = 'BR'
        const view = render()
        await waitFor(() => expect(view.flow().residenceCountry).toBe('AR'))
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('P3-13 the IP suggestion waits until the edge signal settles', async () => {
        mockEdgeSettled = false
        mockIpCountry = 'BR'
        const view = render()
        expect(view.flow().residenceCountry).toBe('')
        mockEdgeSettled = true
        view.rerenderSame()
        await waitFor(() => expect(view.flow().residenceCountry).toBe('BR'))
    })

    it.each(['en', 'es-AR'] as const)(
        'v7: the sentence states the nationality as a nationality, in prod’s wording, with no hint line by default (%s)',
        (locale) => {
            const view = render({ residenceCountry: 'AR' }, { locale })
            const ar = labelOf('AR', locale)
            const line = screen.getByText(textMatch(sentence(ar, ar, locale)))
            expect(line).toBeInTheDocument()
            expect(visibleText(line)).toMatch(
                locale === 'en' ? /resident of .+ nationality of/ : /residencia .+ nacionalidad/
            )
            expect(visibleText(view.container)).not.toContain(HINT[locale])
        }
    )

    it.each(['en', 'es-AR'] as const)(
        'P3-15 the stage headline and the residence drawer title are "Where do you live?" (%s)',
        (locale) => {
            const view = render({ residenceCountry: 'AR' }, { locale })
            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                copyRx(`${K}.sheetResidence`, {}, locale)
            )
            fireEvent.click(view.residencePill())
            expect(
                within(screen.getByRole('dialog')).getByText(copyRx(`${K}.sheetResidence`, {}, locale))
            ).toBeInTheDocument()
        }
    )

    it('P3-15 the nationality drawer title is "What’s your nationality?"', () => {
        const view = render({ residenceCountry: 'AR' })
        fireEvent.click(view.nationalityPill())
        expect(within(screen.getByRole('dialog')).getByText(copyRx(`${K}.sheetNationality`))).toBeInTheDocument()
    })

    it('P3-15 the pills name their drawer in the accessible name (composed, as dev)', () => {
        const view = render({ residenceCountry: 'PT' })
        expect(view.residencePill()).toHaveAccessibleName(textRx(`${copy(`${K}.sheetResidence`)}: ${labelOf('PT')}`))
        expect(view.nationalityPill()).toHaveAccessibleName(
            textRx(`${copy(`${K}.sheetNationality`)}: ${copy(`${K}.sameRow`)}, ${labelOf('PT')}`)
        )
        expect(view.residencePill()).toHaveAttribute('aria-haspopup', 'dialog')
    })

    it('P3-16 the nationality drawer leads with "The same country", then search, then every offered country; the row clears the nationality', () => {
        const view = render({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        fireEvent.click(view.nationalityPill())
        const dialog = screen.getByRole('dialog')
        const same = within(dialog).getByRole('button', { name: new RegExp(`^${copy(`${K}.sameRow`)}`) })
        expect(visibleText(same)).toContain(labelOf('PT'))
        const search = within(dialog).getByRole('searchbox', { name: copyRx(`${K}.search`) })
        const options = buildResidenceCountryOptions('en')
        const labels = new Set(options.map((o) => o.label))
        const rows = within(dialog)
            .getAllByRole('button')
            .filter((b) => labels.has(visibleText(b)))
        expect(rows).toHaveLength(options.length)
        // DOM order: the same-country row, then the search field, then the list
        expect(same.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(search.compareDocumentPosition(rows[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

        capture.mockClear()
        fireEvent.click(same)
        expect(view.flow().nationalityCountry).toBe('')
        expect(controls()).toEqual(['nationality_country:select:same'])
    })

    it('P3-16 lists the sanctioned countries too, so residents can answer truthfully', () => {
        const view = render()
        fireEvent.click(view.residencePill())
        const dialog = screen.getByRole('dialog')
        for (const iso2 of ['RU', 'IR', 'KP', 'SY', 'CU', 'MM']) {
            expect(within(dialog).getByRole('button', { name: textRx(labelOf(iso2)) })).toBeInTheDocument()
        }
    })

    it('P3-17 a search with no match shows the no-country line and reports it once; the first keystroke reports once', () => {
        const view = render({ residenceCountry: 'PT' })
        fireEvent.click(view.residencePill())
        const search = screen.getByRole('searchbox', { name: copyRx(`${K}.search`) })
        fireEvent.change(search, { target: { value: 'z' } })
        fireEvent.change(search, { target: { value: 'zzz' } })
        expect(screen.getByText(copyRx(`${K}.noCountry`, { query: 'zzz' }))).toBeInTheDocument()
        fireEvent.change(search, { target: { value: 'zzzz' } })
        expect(controls()).toEqual([
            'residence_country:open',
            'residence_country_search:change',
            'residence_country_search:error:no_results',
        ])
    })

    it('P3-18 open then close without a pick reports open and dismiss; picking BR reports select:BR and closes', async () => {
        const view = render({ residenceCountry: 'PT' })
        fireEvent.click(view.residencePill())
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        await waitFor(() => expect(openDialog()).toBeNull())
        fireEvent.click(view.residencePill())
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: textRx(labelOf('BR')) }))
        await waitFor(() => expect(openDialog()).toBeNull())
        expect(view.flow().residenceCountry).toBe('BR')
        expect(controls()).toEqual([
            'residence_country:open',
            'residence_country:dismiss',
            'residence_country:open',
            'residence_country:select:BR',
        ])
        expect(capture.mock.calls[0][1]).toEqual(
            expect.objectContaining({ screen_id: 'residence', setup_host: 'signup' })
        )
    })

    it.each(['residence', 'nationality'] as const)(
        'R2-06 the %s drawer takes focus on open (the sheet, not its search field) and Escape closes it',
        async (which) => {
            const view = render({ residenceCountry: 'PT', nationalityCountry: 'BR' })
            const pill = which === 'residence' ? view.residencePill() : view.nationalityPill()
            pill.focus()
            fireEvent.click(pill)
            const dialog = await waitFor(() => openDialog()!)
            await waitFor(() => expect(document.activeElement).toBe(dialog))
            expect(screen.getByRole('searchbox', { hidden: true })).not.toHaveFocus()
            fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
            await waitFor(() => expect(openDialog()).toBeNull())
            // Focus going back to the pill is Radix's close behaviour; jsdom keeps the closing sheet mounted, so it is
            // not asserted here (R2 saw it work in Chromium).
        }
    )

    it.each([
        ['residence', 'PT'],
        ['nationality', 'BR'],
    ] as const)('FXE the %s drawer opens with the chosen country centred in the list', async (which, chosen) => {
        // jsdom lays nothing out: the chosen row sits 2000 px down a 600 px list, every row is 56 px tall
        const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            return { top: this.hasAttribute('aria-current') ? 2000 : 0 } as DOMRect
        })
        const client = jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
        const offset = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(56)
        const scrolled = new Map<Element, number>()
        const scrollTop = jest.spyOn(Element.prototype, 'scrollTop', 'set').mockImplementation(function (
            this: Element,
            top: number
        ) {
            scrolled.set(this, top)
        })
        try {
            const view = render({ residenceCountry: 'PT', nationalityCountry: 'BR' })
            fireEvent.click(which === 'residence' ? view.residencePill() : view.nationalityPill())
            const dialog = await waitFor(() => openDialog()!)
            const row = within(dialog).getByRole('button', { name: textRx(labelOf(chosen)) })
            expect(row).toHaveAttribute('aria-current')
            const area = row.closest<HTMLElement>('.overflow-auto')!
            await waitFor(() => expect(scrolled.get(area)).toBe(2000 - (600 - 56) / 2))
        } finally {
            scrollTop.mockRestore()
            rect.mockRestore()
            client.mockRestore()
            offset.mockRestore()
        }
    })

    it('FXE country rows take the mock heights: 56 px (py-3), 44 on a small phone; the same-country row 64 (52)', () => {
        const view = render({ residenceCountry: 'PT' })
        fireEvent.click(view.nationalityPill())
        const dialog = screen.getByRole('dialog')
        const row = within(dialog).getByRole('button', { name: textRx(labelOf('BR')) })
        expect(row).toHaveClass('py-3', 'signup-sm:py-1.5')
        const same = within(dialog).getByRole('button', { name: new RegExp(`^${copy(`${K}.sameRow`)}`) })
        expect(same).toHaveClass('py-[11px]', 'signup-sm:py-[5px]', 'bg-background-selection')
    })

    it('P3-19 a refused ID issuer as nationality shows the residence-card callout and reports it once', () => {
        mockSets = {
            ...jest.requireActual('@/test-utils/residenceRestrictions.fixture').RESIDENCE_RESTRICTION_SETS,
            refusedIdIssuers: new Set(['CU']),
        }
        const view = render({ residenceCountry: 'AR', nationalityCountry: 'CU' })
        view.rerenderSame()
        expect(
            screen.getByText(
                textMatch(copy(`${K}.refusedPassport`, { nationality: labelOf('CU'), residence: labelOf('AR') }))
            )
        ).toBeInTheDocument()
        expect(setupState(view.container)).toBe('refused-passport')
        expect(controls()).toEqual(['nationality_country:error:refused_issuer'])
    })

    it('R2-05 with the callout the sentence block ends 16 px above the CTA and scrolls; without it, no cap', () => {
        mockSets = {
            ...jest.requireActual('@/test-utils/residenceRestrictions.fixture').RESIDENCE_RESTRICTION_SETS,
            refusedIdIssuers: new Set(['CU']),
        }
        const view = render({ residenceCountry: 'AR', nationalityCountry: 'CU' })
        view.rerenderSame()
        const box = view.container.querySelector('[data-residence-scroll]')!
        // the callout sits inside the capped box, so it can never run under the button
        expect(box).toContainElement(screen.getByRole('alert', { hidden: true }))
        expect(box).toHaveClass('max-h-[calc(var(--sr-panel-to-cta)-16px)]', 'overflow-y-auto')
        // the cap reads the panel's own distance to the CTA
        const panel = box.closest<HTMLElement>('[data-setup-panel]')!
        expect(panel.style.getPropertyValue('--sr-panel-to-cta')).toContain('var(--sr-cta-top)')

        view.unmount()
        const plain = render({ residenceCountry: 'DE', nationalityCountry: 'IR' })
        expect(plain.container.querySelector('[data-residence-scroll]')).not.toHaveClass('overflow-y-auto')
    })

    it('P3-19 a refused issuer as the residence (nationality fine) shows no callout', () => {
        mockSets = {
            ...jest.requireActual('@/test-utils/residenceRestrictions.fixture').RESIDENCE_RESTRICTION_SETS,
            refusedIdIssuers: new Set(['CU']),
        }
        const view = render({ residenceCountry: 'CU', nationalityCountry: 'AR' })
        expect(visibleText(view.container)).not.toContain(
            copy(`${K}.refusedPassport`, { nationality: labelOf('AR'), residence: labelOf('CU') })
        )
        expect(setupState(view.container)).toBe('differ')
    })

    it('P3-19 a different, accepted nationality is the differ state', () => {
        mockSets = {
            ...jest.requireActual('@/test-utils/residenceRestrictions.fixture').RESIDENCE_RESTRICTION_SETS,
            refusedIdIssuers: new Set<string>(),
        }
        const view = render({ residenceCountry: 'DE', nationalityCountry: 'IR' })
        expect(setupState(view.container)).toBe('differ')
        expect(controls()).toEqual([])
    })

    it('P3-20 with restriction sets unknown: no refused callout and no outcome event on Continue', () => {
        mockSetsSettled = false
        const view = render({ residenceCountry: 'DE', nationalityCountry: 'IR' })
        expect(setupState(view.container)).not.toBe('refused-passport')
        expect(visibleText(view.container)).not.toContain(
            copy(`${K}.refusedPassport`, { nationality: labelOf('IR'), residence: labelOf('DE') })
        )
        fireEvent.click(view.continueButton())
        fireEvent.click(view.selectButton('DE'))
        expect(events(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED)).toEqual([
            expect.objectContaining({ residence_country: 'DE' }),
        ])
        for (const outcome of OUTCOMES) expect(events(outcome)).toEqual([])
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('P3-21 mounts dev’s ResidenceHero in the art layer, and no thinking peanut', () => {
        const view = render({ residenceCountry: 'AR' })
        expect(view.container.querySelector('[data-setup-art-layer] [data-residence-hero]')).not.toBeNull()
        expect(view.container.querySelector('[data-mascot-lot="thinking"], [data-mascot-pose="thinking"]')).toBeNull()
    })

    it('P3-24 Continue with nationality = residence reports the selection and one outcome, then advances once the context holds it', () => {
        mockEdgeCountry = 'BR'
        const view = render()
        const seenAtNext: string[] = []
        mockHandleNext.mockImplementation(() => {
            seenAtNext.push(view.flow().residenceCountry)
        })
        fireEvent.click(view.continueButton())
        expect(controls()).toEqual(['continue:tap'])
        expect(events(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED)).toEqual([
            expect.objectContaining({
                residence_country: 'BR',
                nationality_differs: false,
                compared: false,
                was_prefilled: true,
                residence_prefill_source: 'vercel_ip_country',
                signup_vercel_ip_country: 'BR',
                signup_country_suggestion: 'BR',
                signup_country_suggestion_source: 'vercel_ip_country',
            }),
        ])
        expect(events(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED)[0]).toHaveProperty('geo_country')
        expect(OUTCOMES.flatMap((name) => events(name))).toHaveLength(1)
        expect(events(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN)).toEqual([
            expect.objectContaining({ residence_country: 'BR' }),
        ])
        expect(seenAtNext).toEqual(['BR'])
    })

    it.each([
        ['RU', ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN, undefined],
        ['JP', ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN, 'banking'],
        ['IN', ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN, 'card'],
        ['PT', ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN, undefined],
    ])('P3-24 a confirmed %s reports exactly one outcome (%s) and still advances', (iso2, outcome, kind) => {
        const view = render({ residenceCountry: iso2 })
        fireEvent.click(view.continueButton())
        expect(OUTCOMES.flatMap((name) => events(name))).toHaveLength(1)
        expect(events(outcome)).toEqual([
            expect.objectContaining({ residence_country: iso2, ...(kind ? { restriction_type: kind } : {}) }),
        ])
        expect(view.flow().residenceCountry).toBe(iso2)
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('P3-24 does not advance while the flow is already loading (advancing)', () => {
        mockIsLoading = true
        const view = render({ residenceCountry: 'BR' })
        expect(view.continueButton()).toBeDisabled()
        fireEvent.click(view.continueButton())
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('P3-33 on the sentence view the step registers no back handler: the stepper owns Back', () => {
        render({ residenceCountry: 'BR' })
        expect(dispatchBackPress()).toBe(false)
    })

    it('P3-34 signed in and no host: confirming saves residence and nationality once, without waiting', () => {
        const view = render({ residenceCountry: 'PT' })
        fireEvent.click(view.continueButton())
        expect(mockUpdateUserById).toHaveBeenCalledTimes(1)
        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'user-1', residenceCountry: 'PT', nationality: 'PT' })
        // the save never settles, yet the step moved on with the residence in the context
        expect(view.flow().residenceCountry).toBe('PT')
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('P3-34 the verify prelude (onFinish) saves nothing itself and its controls name the host', () => {
        const view = render({ residenceCountry: 'PT' }, { onFinish: async () => undefined })
        fireEvent.click(view.continueButton())
        expect(mockUpdateUserById).not.toHaveBeenCalled()
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
        expect(capture.mock.calls.find(([e]) => e === 'control_used')?.[1]).toEqual(
            expect.objectContaining({ setup_host: 'verify-prelude' })
        )
    })

    it('P3-34 before the account exists nothing is saved; the draft holds the answers', () => {
        mockUserId = null
        const view = render({ residenceCountry: 'PT', nationalityCountry: '' })
        fireEvent.click(view.continueButton())
        expect(mockUpdateUserById).not.toHaveBeenCalled()
        expect(view.flow().residenceCountry).toBe('PT')
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it.each(['en', 'es-AR'] as const)('P3-08 no banned word on 07 in any sentence state (%s)', (locale) => {
        const view = render({ residenceCountry: 'AR', nationalityCountry: 'BR' }, { locale })
        expect(visibleText(view.container)).not.toMatch(
            /platinum|cashback|bono|no password|sin contraseña|suggested|example|ejemplo/i
        )
    })

    it('info-line option a (the default): no hint line on 07 in the empty, default or differ state', () => {
        for (const seed of [{}, { residenceCountry: 'AR' }, { residenceCountry: 'AR', nationalityCountry: 'BR' }]) {
            const view = render(seed)
            expect(visibleText(view.container)).not.toContain(HINT.en)
            view.unmount()
        }
    })
})

// ---- compare view -------------------------------------------------------------------------------------------

describe('07 Residence: compare view', () => {
    const openCompare = (seed: FlowSeed, locale?: AppLocale) => {
        const view = render(seed, { locale })
        fireEvent.click(view.continueButton())
        return view
    }

    it('P3-25 Continue with a different nationality opens compare and does not advance', () => {
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        expect(controls()).toEqual(['continue:tap', 'residence_compare:open'])
        expect(setupState(view.container)).toBe('compare')
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(mockUpdateUserById).not.toHaveBeenCalled()
    })

    it('P3-26 compare shows the new title and rule line and no old guide callout', () => {
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copyRx(`${K}.compareTitle`))
        expect(screen.getByText(textMatch(copy(`${K}.compareRule`)))).toBeInTheDocument()
        expect(visibleText(view.container)).not.toContain(copy('setup.residenceStep.compare.guideTitle'))
    })

    it('P3-21 compare unmounts the hero and shows no mascot', () => {
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        expect(view.container.querySelector('[data-residence-hero]')).toBeNull()
        expect(view.container.querySelector('[data-mascot-lot], [data-mascot-pose]')).toBeNull()
    })

    it.each(['en', 'es-AR'] as const)(
        'P3-27 lists each country’s served offers: local rail first, one bank account item with ISO codes, card, P2P last (%s)',
        (locale) => {
            mockIntents = {
                PT: { intents: intents({}), settled: true },
                BR: { intents: intents({ local: { available: true } }), settled: true },
            }
            const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' }, locale)
            const bank = copy(`${K}.itemBankAccount`, { currencies: orList(['USD', 'EUR'], locale) }, locale)
            expect(bank).toContain(orList(['USD', 'EUR'], locale))
            const card = copy(`${K}.itemCard`, {}, locale)
            const p2p = copy(`${K}.itemP2p`, {}, locale)
            expect(view.items('PT')).toEqual([bank, card, p2p])
            expect(view.items('BR')).toEqual([copy(`${K}.itemPix`, {}, locale), bank, card, p2p])
        }
    )

    it('P3-27 / K1 a column names every served currency in served order', () => {
        mockIntents = {
            PT: {
                intents: intents({ bank: { available: true, currencies: ['USD', 'EUR', 'GBP', 'MXN'] } }),
                settled: true,
            },
            BR: {
                intents: intents({ local: { available: true }, card: { available: false, reason: 'geo-blocked' } }),
                settled: true,
            },
        }
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        expect(view.items('PT')[0]).toBe(
            copy(`${K}.itemBankAccount`, { currencies: orList(['USD', 'EUR', 'GBP', 'MXN']) })
        )
        expect(view.items('PT')[0]).toContain('USD, EUR, GBP or MXN')
        // a ruled-out item is left out, not struck through
        expect(view.items('BR')).not.toContain(copy(`${K}.itemCard`))
    })

    it('P3-27 (§ 3.6) a failed intents read falls back to the tiers: generic bank account, card, P2P', () => {
        mockIntents = {
            PT: { intents: undefined, settled: true },
            BR: { intents: intents({ local: { available: true } }), settled: true },
        }
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        expect(view.items('PT')).toEqual([copy(`${K}.itemBank`), copy(`${K}.itemCard`), copy(`${K}.itemP2p`)])
    })

    it('P3-29 equal lists: neither list nor the note shows, the rule line stays, state compare-equal', () => {
        mockIntents = {
            PT: { intents: intents({}), settled: true },
            DE: { intents: intents({}), settled: true },
        }
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'DE' })
        expect(setupState(view.container)).toBe('compare-equal')
        expect(view.items('PT')).toEqual([])
        expect(view.items('DE')).toEqual([])
        expect(visibleText(view.column('PT'))).toContain(labelOf('PT'))
        expect(visibleText(view.container)).not.toContain(copy(`${K}.compareCurrencyNote`))
        expect(screen.getByText(textMatch(copy(`${K}.compareRule`)))).toBeInTheDocument()
    })

    it('P3-30 no list renders while either column is loading; both render once both settle with different lists', () => {
        mockIntents = {
            PT: { intents: intents({}), settled: true },
            BR: { intents: undefined, settled: false },
        }
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        expect(setupState(view.container)).toBe('compare-loading')
        expect(view.items('PT')).toEqual([])
        expect(view.items('BR')).toEqual([])
        mockIntents = {
            PT: { intents: intents({}), settled: true },
            BR: { intents: intents({ local: { available: true } }), settled: true },
        }
        view.rerenderSame()
        expect(setupState(view.container)).toBe('compare')
        expect(view.items('PT').length).toBeGreaterThan(0)
        expect(view.items('BR').length).toBeGreaterThan(0)
    })

    it('P3-31 the currency note shows once under the columns when a column spans several currencies', () => {
        mockIntents = {
            PT: { intents: intents({}), settled: true },
            BR: { intents: intents({ local: { available: true } }), settled: true },
        }
        openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        expect(screen.getAllByText(copyRx(`${K}.compareCurrencyNote`))).toHaveLength(1)
    })

    it('P3-31 no currency note while the lists are hidden', () => {
        mockIntents = {
            PT: { intents: intents({}), settled: true },
            BR: { intents: undefined, settled: false },
        }
        openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        expect(screen.queryByText(copyRx(`${K}.compareCurrencyNote`))).toBeNull()
    })

    it.each(['en', 'es-AR'] as const)(
        'P3-32 compare buttons: residence primary, nationality secondary (%s)',
        async (locale) => {
            const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' }, locale)
            // the primary keeps "Continue" until its 100 ms label crossfade ends
            await waitFor(() =>
                expect(view.selectButton('PT')).toHaveTextContent(
                    copyRx(`${K}.select`, { country: labelOf('PT', locale) }, locale)
                )
            )
            expect(view.selectButton('BR')).toHaveTextContent(
                copyRx(`${K}.select`, { country: labelOf('BR', locale) }, locale)
            )
            // the primary comes first in the footer
            expect(
                view.selectButton('PT').compareDocumentPosition(view.selectButton('BR')) &
                    Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy()
        }
    )

    it('P3-32 picking the nationality sets it as the residence, keeps the nationality, and advances only once the context holds it', () => {
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        const seenAtNext: string[] = []
        mockHandleNext.mockImplementation(() => {
            seenAtNext.push(view.flow().residenceCountry)
        })
        capture.mockClear()
        fireEvent.click(view.selectButton('BR'))
        expect(controls()).toEqual(['compare_choice:tap:nationality'])
        expect(view.flow().residenceCountry).toBe('BR')
        expect(view.flow().nationalityCountry).toBe('BR')
        expect(events(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED)).toEqual([
            expect.objectContaining({ residence_country: 'BR', compared: true, was_prefilled: false }),
        ])
        expect(seenAtNext).toEqual(['BR'])
        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'user-1', residenceCountry: 'BR', nationality: 'BR' })
    })

    it('P3-32 picking the residence keeps it and saves the nationality beside it', () => {
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        fireEvent.click(view.selectButton('PT'))
        expect(view.flow().residenceCountry).toBe('PT')
        expect(controls()).toContain('compare_choice:tap:residence')
        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'user-1', residenceCountry: 'PT', nationality: 'BR' })
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('P3-32 while the step advances both compare buttons are disabled with spinners', () => {
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        mockIsLoading = true
        view.rerenderSame()
        for (const iso2 of ['PT', 'BR']) {
            expect(view.selectButton(iso2)).toBeDisabled()
            expect(within(view.selectButton(iso2)).getByRole('status')).toBeInTheDocument()
        }
    })

    it('P3-33 hardware Back on compare reports the dismissal and returns to the sentence, staying on the step', () => {
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        act(() => {
            expect(dispatchBackPress()).toBe(true)
        })
        expect(controls()).toEqual(['continue:tap', 'residence_compare:open', 'residence_compare:dismiss'])
        expect(setupState(view.container)).toBe('differ')
        expect(view.nationalityPill()).toBeInTheDocument()
        expect(dispatchBackPress()).toBe(false)
    })

    it('P3-33 the top-bar back arrow on compare goes through the same handler', () => {
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        fireEvent.click(screen.getByRole('button', { name: copyRx('setup.navigation.goBack') }))
        expect(controls()).toContain('residence_compare:dismiss')
        expect(setupState(view.container)).toBe('differ')
    })

    it('P3-08 no banned word on the compare view', () => {
        const view = openCompare({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        expect(visibleText(view.container)).not.toMatch(
            /platinum|cashback|bono|no password|sin contraseña|suggested|example|ejemplo/i
        )
    })
})

// ---- ported from dev's Views/__tests__/Residence.test.tsx (deleted with the old view) -----------------------

describe('07 Residence: dev cases kept', () => {
    // mirrors peanut-api-ts FULL_RESTRICTED_RESIDENCE (api#1738)
    it.each(['CN', 'IR', 'RU', 'BY', 'GB', 'KP', 'SY', 'CU', 'MM', 'VE', 'IQ', 'PS', 'YE', 'SS', 'CD'])(
        'P3-24 a confirmed %s reports the restricted outcome only and still advances',
        (iso2) => {
            const view = render({ residenceCountry: iso2 })
            fireEvent.click(view.continueButton())
            expect(OUTCOMES.flatMap((name) => events(name))).toHaveLength(1)
            expect(events(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN)).toEqual([
                expect.objectContaining({ residence_country: iso2 }),
            ])
            expect(mockHandleNext).toHaveBeenCalledTimes(1)
        }
    )

    it.each([
        ['IN', 'card'],
        ['TR', 'card'],
        ['UA', 'card'],
        ['VN', 'card'],
        ['IL', 'card'],
        ['NP', 'card'],
        ['NI', 'card'],
        // Rain's Platform Standards list, and Nigeria until Rain approves Peanut there
        ['TZ', 'card'],
        ['ID', 'card'],
        ['NG', 'card'],
        ['ZA', 'card'],
        ['DZ', 'banking'],
        ['BI', 'banking'],
        ['GW', 'banking'],
        ['JP', 'banking'],
        ['TN', 'banking'],
        // Bridge's Prohibited list (api#1738, TASK-23054 R2)
        ['AF', 'banking'],
        ['SD', 'banking'],
        ['LY', 'banking'],
        ['LB', 'banking'],
        ['SO', 'banking'],
    ])('P3-24 a confirmed %s reports a partial (%s) outcome and advances', (iso2, kind) => {
        const view = render({ residenceCountry: iso2 })
        fireEvent.click(view.continueButton())
        expect(OUTCOMES.flatMap((name) => events(name))).toHaveLength(1)
        expect(events(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN)).toEqual([
            expect.objectContaining({ residence_country: iso2, restriction_type: kind }),
        ])
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    // TASK-23054 R1: HK was restricted for a Sumsub document rule, which never decides eligibility
    it('P3-24 Hong Kong is unrestricted: the congrats outcome', () => {
        const view = render({ residenceCountry: 'HK' })
        fireEvent.click(view.continueButton())
        expect(OUTCOMES.flatMap((name) => events(name))).toHaveLength(1)
        expect(events(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN)).toEqual([
            expect.objectContaining({ residence_country: 'HK' }),
        ])
    })

    it('P3-24 the outcome follows the served tiers, not a built-in list', () => {
        mockSets = {
            ...jest.requireActual('@/test-utils/residenceRestrictions.fixture').RESIDENCE_RESTRICTION_SETS,
            full: new Set(['PT']),
            cardOnly: new Set(),
            bankingOnly: new Set(),
        }
        const view = render({ residenceCountry: 'PT' })
        fireEvent.click(view.continueButton())
        expect(OUTCOMES.flatMap((name) => events(name))).toHaveLength(1)
        expect(events(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN)).toEqual([
            expect.objectContaining({ residence_country: 'PT' }),
        ])
    })

    it('P3-19 a Russian passport is not refused (it still verifies everything but the card)', () => {
        const view = render({ residenceCountry: 'DE', nationalityCountry: 'RU' })
        expect(setupState(view.container)).toBe('differ')
        expect(visibleText(view.container)).not.toContain(
            copy(`${K}.refusedPassport`, { nationality: labelOf('RU'), residence: labelOf('DE') })
        )
        expect(controls()).toEqual([])
    })

    it('P3-32 picking the nationality on compare reports its outcome once (JP: banking partial)', () => {
        const view = render({ residenceCountry: 'PT', nationalityCountry: 'JP' })
        fireEvent.click(view.continueButton())
        fireEvent.click(view.selectButton('JP'))
        expect(OUTCOMES.flatMap((name) => events(name))).toHaveLength(1)
        expect(events(ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN)).toEqual([
            expect.objectContaining({ residence_country: 'JP', restriction_type: 'banking' }),
        ])
        expect(view.flow().residenceCountry).toBe('JP')
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('P3-30 while the restriction lists load, a column whose intents read failed keeps compare loading', () => {
        mockSetsSettled = false
        mockIntents = {
            PT: { intents: undefined, settled: true },
            BR: { intents: intents({ local: { available: true } }), settled: true },
        }
        const view = render({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        fireEvent.click(view.continueButton())
        expect(setupState(view.container)).toBe('compare-loading')
        expect(view.items('PT')).toEqual([])
        expect(view.items('BR')).toEqual([])
    })

    it('P3-27 (§ 3.6) with the restriction lists failed a served column lists its offers, and a failed one lists only P2P', () => {
        mockSets = null
        mockIntents = {
            PT: { intents: undefined, settled: true },
            BR: { intents: intents({ local: { available: true } }), settled: true },
        }
        const view = render({ residenceCountry: 'PT', nationalityCountry: 'BR' })
        fireEvent.click(view.continueButton())
        expect(setupState(view.container)).toBe('compare')
        expect(view.items('PT')).toEqual([copy(`${K}.itemP2p`)])
        expect(view.items('BR')).toEqual([
            copy(`${K}.itemPix`),
            copy(`${K}.itemBankAccount`, { currencies: orList(['USD', 'EUR']) }),
            copy(`${K}.itemCard`),
            copy(`${K}.itemP2p`),
        ])
    })
})

// ---- v7 (TASK-25063): "Why do we ask?", the Popular countries, the info-line options ----------------------------

describe('07 Residence: v7', () => {
    const KYC = 'kyc.paperworkVerification'
    const whyLink = (container: HTMLElement) => within(footer(container)!).queryByTestId('setup-residence-why')
    const withInfoLine = (option: string) => window.history.replaceState({}, '', `/setup?infoline=${option}`)
    afterEach(() => window.history.replaceState({}, '', '/'))

    it('"Why do we ask?" under Continue opens the nationality reason; Got it closes it; both are tracked', async () => {
        const view = render({ residenceCountry: 'AR' })
        fireEvent.click(whyLink(view.container)!)
        const sheet = await waitFor(() => openDialog(copyRx(`${KYC}.whyTitle`))!)
        expect(within(sheet).getByText(copy(`${KYC}.why.nationality`))).toBeInTheDocument()
        expect(within(sheet).getByText(copy(`${KYC}.whyShared`))).toBeInTheDocument()
        expect(within(sheet).queryByText(HINT.en)).toBeNull()
        fireEvent.click(within(sheet).getByRole('button', { name: copy(`${KYC}.gotIt`) }))
        await waitFor(() => expect(openDialog(copyRx(`${KYC}.whyTitle`))).toBeNull())
        expect(controls()).toEqual(['why:open', 'why_got_it:tap'])
    })

    it('a refused passport shows the callout and no "Why do we ask?" link (no room for both)', () => {
        const view = render({ residenceCountry: 'AR', nationalityCountry: 'CU' })
        expect(
            screen.getByText(copy(`${K}.refusedPassport`, { nationality: labelOf('CU'), residence: labelOf('AR') }))
        ).toBeInTheDocument()
        expect(whyLink(view.container)).toBeNull()
        // the longer v7 sentence leaves the callout no room on a std phone (375x667) unless the stage is compact
        // (the hero box starts at the compact stage's 120 design px, not the std stage's 150)
        expect(view.container.querySelector<HTMLElement>('[data-residence-hero-box]')!.style.top).toBe('120px')
    })

    it('the country list leads with Argentina and Brazil under "Popular", each listed once; a search drops the header', () => {
        const view = render({ residenceCountry: 'PT' })
        fireEvent.click(view.residencePill())
        const sheet = openDialog()!
        const popular = within(sheet)
            .getByRole('heading', { name: copy(`${K}.popular`) })
            .closest('section')!
        expect(
            within(popular)
                .getAllByRole('button')
                .map((row) => row.getAttribute('aria-label'))
        ).toEqual([labelOf('AR'), labelOf('BR')])
        expect(within(sheet).getAllByRole('button', { name: labelOf('AR') })).toHaveLength(1)
        fireEvent.change(within(sheet).getByRole('searchbox'), { target: { value: 'arg' } })
        expect(within(sheet).queryByRole('heading', { name: copy(`${K}.popular`) })).toBeNull()
        expect(within(sheet).getByRole('button', { name: labelOf('AR') })).toBeInTheDocument()
    })

    it('info-line option b: no line on the screen; the sheet also holds "Tap a country to change it."', async () => {
        withInfoLine('b')
        const view = render({ residenceCountry: 'AR' })
        expect(screen.queryByTestId('setup-residence-hint')).toBeNull()
        fireEvent.click(whyLink(view.container)!)
        const sheet = await waitFor(() => openDialog(copyRx(`${KYC}.whyTitle`))!)
        expect(within(sheet).getByText(HINT.en)).toBeInTheDocument()
        expect(within(sheet).getByText(copy(`${KYC}.why.nationality`))).toBeInTheDocument()
    })

    it('info-line option c: one line under the sentence holds the hint and the link; the footer has no link', async () => {
        withInfoLine('c')
        const view = render({ residenceCountry: 'AR' })
        const line = await screen.findByTestId('setup-residence-hint')
        expect(line).toHaveTextContent(HINT.en)
        expect(within(line).getByTestId('setup-residence-why')).toBeInTheDocument()
        expect(line.closest('[data-setup-screen="residence"]')).not.toBeNull()
        expect(whyLink(view.container)).toBeNull()
    })
})
