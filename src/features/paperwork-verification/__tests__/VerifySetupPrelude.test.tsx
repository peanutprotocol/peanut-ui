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
import { updateUserById } from '@/app/actions/users'
import { savePaperworkVerificationFeatures } from '@/app/actions/kyc-paperwork-verification'
import { LOCAL_RESIDENCE_RESTRICTION_SETS } from '@/hooks/useResidenceRestrictionSets'
import { VerifySetupPrelude } from '../components/VerifySetupPrelude'

jest.mock('@/components/Setup/components/SetupWrapper', () => ({
    SetupWrapper: ({ title, onBack, children }: { title?: ReactNode; onBack?: () => void; children: ReactNode }) => (
        <div>
            {title && <h2>{title}</h2>}
            <button onClick={onBack}>setup-back</button>
            {children}
        </div>
    ),
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
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({
    ...jest.requireActual('@/hooks/useResidenceRestrictionSets'),
    useResidenceRestrictionSetsWithStatus: () => ({ sets: LOCAL_RESIDENCE_RESTRICTION_SETS, settled: true }),
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
        <NuqsTestingAdapter hasMemory>
            <AfterAdapter>
                <VerifySetupPrelude needs={needs} onDone={onDone} onExit={onExit} />
            </AfterAdapter>
        </NuqsTestingAdapter>
    )
    return { onDone, onExit }
}

async function choose(kind: 'Add money with' | 'Make a payment with', choice: string) {
    fireEvent.click(await screen.findByRole('button', { name: `${kind}: Choose`, hidden: true }))
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

    expect(await screen.findByRole('heading', { name: 'Country of legal residence' })).toBeInTheDocument()
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    })

    await choose('Add money with', 'Bank transfer')
    await choose('Make a payment with', 'QR payments')
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Continue', hidden: true }))
    })

    expect(updateUserById).toHaveBeenCalledWith({ userId: 'user-1', residenceCountry: 'PT' })
    expect(savePaperworkVerificationFeatures).toHaveBeenCalledWith({ qr: true, bank: true, local: false, card: false })
    expect(onDone).toHaveBeenCalled()
})

it('a known residence asks only the payment plan, and back from it leaves the flow', async () => {
    mockDeclared = 'PT'
    const { onExit, onDone } = render(['features'])

    expect(await screen.findByRole('button', { name: 'Add money with: Choose', hidden: true })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Country of legal residence' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'setup-back' }))
    expect(onExit).toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
})

it('a residence that does not save stays on screen with an error, and /verify does not reload', async () => {
    jest.mocked(updateUserById).mockResolvedValueOnce({ error: 'nope' } as never)
    mockDeclared = null
    const { onDone } = render(['residence'])

    await screen.findByRole('heading', { name: 'Country of legal residence' })
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    })

    expect(mockToastError).toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
})
