jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * An older account /verify cannot ask questions for yet answers signup's own
 * screens first: the residence, then how they add money and spend. Same
 * components and saves as signup, then /verify reloads.
 */
import { type ReactNode, useEffect, useState } from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { renderWithIntl } from '@/test-utils/intl'
import { AppLocaleContext } from '@/i18n/app/locale-context'
import { copy, copyRx } from '@/components/Setup/redesign/Accounts/__tests__/redesignHarness'
import { updateUserById } from '@/app/actions/users'
import { savePaperworkVerificationFeatures } from '@/app/actions/kyc-paperwork-verification'
import { RESIDENCE_RESTRICTION_SETS } from '@/test-utils/residenceRestrictions.fixture'
import { VerifySetupPrelude } from '../components/VerifySetupPrelude'

// The real shell draws the footer and the top-bar Back.
jest.mock('framer-motion', () =>
    require('@/components/Setup/redesign/Accounts/__tests__/framerMock').framerMotionForShell()
)
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: { loadAnimation: () => ({ addEventListener: jest.fn(), destroy: jest.fn(), goToAndStop: jest.fn() }) },
}))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn(async () => ({ data: {} })) }))
jest.mock('@/app/actions/kyc-paperwork-verification', () => ({
    savePaperworkVerificationFeatures: jest.fn(async () => ({ kind: 'saved' })),
}))
let mockDeclared: string | null = null
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => null,
    useAuth: () => ({ user: { user: { userId: 'user-1' }, residence: { declared: mockDeclared } } }),
}))
jest.mock('@/hooks/useKycIntents', () => ({
    useKycIntents: (country: string) => ({
        intents: jest.requireActual('@/test-utils/kycIntents.fixture').KYC_INTENTS_BY_COUNTRY[country],
        settled: true,
    }),
}))
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({
    ...jest.requireActual('@/hooks/useResidenceRestrictionSets'),
    useResidenceRestrictionSetsWithStatus: () => ({ sets: RESIDENCE_RESTRICTION_SETS, settled: true }),
}))
jest.mock('@/features/setup/useSetupCountrySignals', () => ({
    useSetupCountrySignals: () => ({ ipCountry: 'PT', edgeSettled: true }),
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
const mockToastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))

// The nuqs testing adapter resets its URL memory in its own mount effect, which runs
// after a child's: the prelude mounts once it has, as it would under the app's adapter.
function AfterAdapter({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    return mounted ? children : null
}

const render = (needs: ('residence' | 'features')[]) => {
    const onDone = jest.fn(async () => {})
    const onExit = jest.fn()
    renderWithIntl(
        <AppLocaleContext.Provider value={{ locale: 'en', setLocale: async () => {} }}>
            <NuqsTestingAdapter hasMemory>
                <AfterAdapter>
                    <VerifySetupPrelude needs={needs} onDone={onDone} onExit={onExit} />
                </AfterAdapter>
            </NuqsTestingAdapter>
        </AppLocaleContext.Provider>
    )
    return { onDone, onExit }
}

const RESIDENCE_TITLE = () => copyRx('setupRedesign.residence.sheetResidence')
const back = () => screen.getByRole('button', { name: copy('setup.navigation.goBack') })
const continueButton = () => screen.getByRole('button', { name: copyRx('setupRedesign.common.continue'), hidden: true })

/** The shell drops taps while a step slides in (one step per tap gesture, R2-01): tap once it has come to rest. */
const settled = () =>
    waitFor(() => expect(document.querySelector('[data-setup-shell]')).not.toHaveAttribute('data-nav-locked'), {
        timeout: 3000,
    })

async function choose(kind: 'sheetFunding' | 'sheetPayment', choice: string) {
    const name = `${copy(`setupRedesign.plan.${kind}`)}: ${copy('setupRedesign.plan.choose')}`
    fireEvent.click(await screen.findByRole('button', { name, hidden: true }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: choice }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
}

beforeEach(() => {
    jest.clearAllMocks()
    mockDeclared = null
})

it('asks the residence, then the payment plan, saves both and reloads /verify', async () => {
    const { onDone } = render(['residence', 'features'])

    expect(await screen.findByRole('heading', { name: RESIDENCE_TITLE() })).toBeInTheDocument()
    await act(async () => {
        fireEvent.click(screen.getByTestId('setup-residence-continue'))
    })

    await choose('sheetFunding', copy('setupRedesign.plan.fundBankCurrencies', { currencies: 'USD, EUR, GBP, MXN' }))
    await choose('sheetPayment', copy('setupRedesign.plan.payQr'))
    await settled()
    await act(async () => {
        fireEvent.click(continueButton())
    })

    expect(updateUserById).toHaveBeenCalledWith({ userId: 'user-1', residenceCountry: 'PT', nationality: 'PT' })
    expect(savePaperworkVerificationFeatures).toHaveBeenCalledWith({ qr: true, bank: true, local: false, card: false })
    expect(onDone).toHaveBeenCalled()
})

it('back from the two-country comparison returns to the residence sentence, not out of the flow', async () => {
    const { onExit } = render(['residence', 'features'])

    await screen.findByRole('heading', { name: RESIDENCE_TITLE() })
    fireEvent.click(screen.getByTestId('setup-nationality-country'))
    fireEvent.click(await within(screen.getByRole('dialog')).findByRole('button', { name: 'Brazil' }))
    fireEvent.click(screen.getByTestId('setup-residence-continue'))
    expect(
        await screen.findByRole('heading', { name: copyRx('setupRedesign.residence.compareTitle') })
    ).toBeInTheDocument()

    fireEvent.click(back())
    expect(await screen.findByRole('heading', { name: RESIDENCE_TITLE() })).toBeInTheDocument()
    expect(onExit).not.toHaveBeenCalled()
})

it('a known residence asks only the payment plan, and back from it leaves the flow', async () => {
    mockDeclared = 'PT'
    const { onExit, onDone } = render(['features'])

    const fundingPill = `${copy('setupRedesign.plan.sheetFunding')}: ${copy('setupRedesign.plan.choose')}`
    expect(await screen.findByRole('button', { name: fundingPill, hidden: true })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: RESIDENCE_TITLE() })).not.toBeInTheDocument()
    fireEvent.click(back())
    expect(onExit).toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
})

it('a residence that does not save stays on screen with an error, and /verify does not reload', async () => {
    jest.mocked(updateUserById).mockResolvedValueOnce({ error: 'nope' } as never)
    mockDeclared = null
    const { onDone } = render(['residence'])

    await screen.findByRole('heading', { name: RESIDENCE_TITLE() })
    await act(async () => {
        fireEvent.click(screen.getByTestId('setup-residence-continue'))
    })

    expect(mockToastError).toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
})
