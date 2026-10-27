import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import {
    getKycReplacementPlan,
    resumeKycDocumentAttempt,
    startKycDocumentReplacement,
} from '@/app/actions/kyc-workflow'
import type { KycDocumentPlan } from '@/app/actions/types/kyc-workflow.types'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { IdentityRestartFlow } from '../IdentityRestartFlow'

// A verified user whose identity came from a verification attempt restarts it
// on the Smart Paperwork Verification ID screen: the pick goes to the restart as its
// replacement, Sumsub opens on the returned session, the review follows.

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('@/utils/confetti', () => ({ confettiPresets: { success: jest.fn() } }))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('@/features/paperwork-verification/components/IdCardScanAnimation', () => ({
    IdCardScanAnimation: () => null,
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({
    getKycReplacementPlan: jest.fn(),
    resumeKycDocumentAttempt: jest.fn(),
    startKycDocumentReplacement: jest.fn(),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { username: 'tester' },
            residence: {
                verified: null,
                declared: { country: 'PT', status: 'UNVERIFIED', updatedAt: null, secondCountry: null },
            },
            // signed up from Ukraine: temporary protection is offered
            geo: { signup: { vercelIp: { country: 'UA', observedAt: '2026-10-01T10:00:00.000Z' } } },
        },
    }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
const mockSdk: { refresh?: () => Promise<string> } = {}
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: (props: {
        visible: boolean
        accessToken: string | null
        documentConfig?: { documentDefinitions?: { IDENTITY?: { country: string; idDocType: string } } }
        sessionKey?: string
        onComplete: () => void
        onClose: () => void
        onRefreshToken: () => Promise<string>
    }) => {
        mockSdk.refresh = props.onRefreshToken
        return props.visible ? (
            <div
                data-testid="sumsub"
                data-token={props.accessToken ?? ''}
                data-session={props.sessionKey ?? ''}
                data-document={JSON.stringify(props.documentConfig?.documentDefinitions?.IDENTITY ?? null)}
            >
                <button onClick={props.onComplete}>sumsub-submit</button>
                <button onClick={props.onClose}>sumsub-close</button>
            </div>
        ) : null
    },
}))

const mockPlan = getKycReplacementPlan as jest.MockedFunction<typeof getKycReplacementPlan>
const mockReplacement = startKycDocumentReplacement as jest.MockedFunction<typeof startKycDocumentReplacement>
const mockResume = resumeKycDocumentAttempt as jest.MockedFunction<typeof resumeKycDocumentAttempt>
const mockCapture = posthog.capture as jest.MockedFunction<typeof posthog.capture>
const captured = (event: string) => mockCapture.mock.calls.filter(([name]) => name === event).map(([, p]) => p)

const plan = {
    available: true,
    activeAttemptId: null,
    policyVersion: 'v7',
    flow: 'verify-once',
    proofOfAddress: null,
    features: { qr: true, bank: true, local: false, card: false },
    routes: [
        {
            id: 'base',
            documents: [
                {
                    key: 'identity',
                    code: 'IDENTITY',
                    requiredBy: ['SUMSUB'],
                    types: ['PASSPORT', 'ID_CARD', 'RESIDENCE_PERMIT'],
                    countries: ['PT', 'ES'],
                },
            ],
        },
    ],
} as KycDocumentPlan
const session = {
    attemptId: 'replacement-1',
    token: 'token-1',
    applicantId: 'applicant-1',
    levelName: 'base',
    status: 'COLLECTING',
    sdkConfig: {
        documentDefinitions: { IDENTITY: { country: 'PRT', idDocType: 'PASSPORT' } },
        autoSelectDocumentDefinitions: true as const,
    },
}

const renderFlow = () =>
    renderWithIntl(
        <NuqsTestingAdapter searchParams="?step=id&restart=1" hasMemory>
            <IdentityRestartFlow onExit={jest.fn()} />
        </NuqsTestingAdapter>
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockPlan.mockResolvedValue(plan)
    mockReplacement.mockResolvedValue({ kind: 'session', session })
    mockResume.mockResolvedValue({ ...session, token: 'token-2' })
})

describe('IdentityRestartFlow', () => {
    it('restarts on the picked ID, opens Sumsub on the returned session, then shows the review', async () => {
        renderFlow()
        expect(await screen.findByText('Verify with a different document')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('verify-id-option-PASSPORT-PT'))

        await waitFor(() => expect(screen.getByTestId('sumsub')).toBeInTheDocument())
        expect(mockReplacement).toHaveBeenCalledWith({
            requestKey: expect.stringMatching(/^[0-9a-f]{32}$/),
            policyVersion: 'v7',
            routeId: 'base',
            documents: [{ key: 'identity', type: 'PASSPORT', issuingCountry: 'PT' }],
        })
        const sdk = screen.getByTestId('sumsub')
        expect(sdk).toHaveAttribute('data-token', 'token-1')
        expect(sdk).toHaveAttribute('data-session', 'replacement-1')
        expect(sdk).toHaveAttribute('data-document', JSON.stringify({ country: 'PRT', idDocType: 'PASSPORT' }))

        fireEvent.click(screen.getByText('sumsub-submit'))
        expect(await screen.findByText('Checking your ID')).toBeInTheDocument()
        expect(screen.queryByTestId('sumsub')).toBeNull()
    })

    it('refreshes the token through the replaced attempt', async () => {
        renderFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-PT'))
        await screen.findByTestId('sumsub')
        await act(async () => {
            await expect(mockSdk.refresh?.()).resolves.toBe('token-2')
        })
        expect(mockResume).toHaveBeenCalledWith('replacement-1')
        expect(screen.getByTestId('sumsub')).toHaveAttribute('data-token', 'token-2')
    })

    it('sends a temporary protection document as the visa Sumsub verifies', async () => {
        mockPlan.mockResolvedValue({
            ...plan,
            temporaryProtection: { countries: ['PT'], until: '2028-03-04', proofOfAddress: false },
        })
        renderFlow()
        fireEvent.click(await screen.findByTestId('verify-id-other'))
        fireEvent.click(screen.getByTestId('verify-id-option-TEMPORARY_PROTECTION-PT'))
        await waitFor(() => expect(mockReplacement).toHaveBeenCalled())
        expect(mockReplacement.mock.calls[0][0].documents).toEqual([
            { key: 'identity', type: 'VISA', issuingCountry: 'PT' },
        ])
    })

    it('shows the API’s message on the ID screen, keeps the user there, and retries on a new request key', async () => {
        mockReplacement.mockResolvedValueOnce({ kind: 'failed', error: 'Your ID is still being checked.' })
        renderFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-PT'))
        expect(await screen.findByTestId('verify-id-error')).toHaveTextContent('Your ID is still being checked.')
        expect(screen.getByTestId('verify-id-option-PASSPORT-PT')).not.toHaveAttribute('aria-disabled')
        expect(screen.queryByTestId('sumsub')).toBeNull()

        fireEvent.click(screen.getByTestId('verify-id-option-PASSPORT-PT'))
        await screen.findByTestId('sumsub')
        const [first, second] = mockReplacement.mock.calls.map(([choices]) => choices.requestKey)
        expect(second).not.toBe(first)
    })

    it('a refusal the API did not word for users shows the localized restart error', async () => {
        mockReplacement.mockResolvedValue({
            kind: 'failed',
            error: 'Failed to restart identity verification',
            code: 'restart_failed',
        })
        renderFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-PT'))
        expect(await screen.findByTestId('verify-id-error')).toHaveTextContent(
            'Could not restart identity verification. Please try again.'
        )
    })

    it('a restart cooldown says when to try again', async () => {
        mockReplacement.mockResolvedValue({
            kind: 'failed',
            error: 'Too many',
            cooldown: { retryAt: '2026-10-24T10:00:00.000Z' },
        })
        renderFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-PT'))
        expect(await screen.findByTestId('verify-id-error')).toHaveTextContent(
            /Verification attempts are temporarily limited. You can try again after Oct 24/
        )
    })

    it('an identity the restart plan does not cover goes Home, to today’s restart', async () => {
        mockPlan.mockResolvedValue(null)
        renderFlow()
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'))
        expect(mockReplacement).not.toHaveBeenCalled()
    })

    it('a failed load offers a retry', async () => {
        mockPlan.mockRejectedValueOnce(new Error('KYC request failed'))
        renderFlow()
        fireEvent.click(await screen.findByTestId('verify-retry-load'))
        expect(await screen.findByTestId('verify-id')).toBeInTheDocument()
        expect(captured(ANALYTICS_EVENTS.KYC_PV_LOAD_FAILED)).toEqual([
            expect.objectContaining({ flow: 'paperwork_verification', restart: true }),
        ])
    })

    it('tracks the ID screen and its outcome as a restart, without the picked values', async () => {
        renderFlow()
        fireEvent.click(await screen.findByTestId('verify-id-option-PASSPORT-PT'))
        await screen.findByTestId('sumsub')
        expect(captured(ANALYTICS_EVENTS.KYC_PV_ID_VIEWED)).toEqual([expect.objectContaining({ restart: true })])
        expect(captured(ANALYTICS_EVENTS.KYC_PV_ID_SUBMITTED)).toEqual([expect.objectContaining({ restart: true })])
        const [outcome] = captured(ANALYTICS_EVENTS.KYC_PV_ID_OUTCOME)
        expect(outcome).toEqual(expect.objectContaining({ restart: true, outcome: 'opened' }))
        expect(outcome).not.toHaveProperty('issuing_country')
        expect(outcome).not.toHaveProperty('document_type')
    })
})
