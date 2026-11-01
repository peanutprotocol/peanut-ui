/**
 * The KYC reads that follow from who the user is, computed from their
 * /users/me the way peanut-api-ts computes them from the same records. Demo
 * mode answers them for the demo user and the Screen Library for each
 * fixture's user, so a new user-dependent KYC read is added here once.
 *
 * A user here is on today's flow; a fixture on Smart Paperwork Verification
 * lays its own plan, questions and profile over these.
 */
import type { KycCollectedDetails } from '@/app/actions/types/kyc-paperwork-verification.types'
import type { KycDocumentPlan, KycProfile } from '@/app/actions/types/kyc-workflow.types'
import type { IUserProfile } from '@/interfaces/interfaces'
import type { paths } from '@/types/api.generated'
import type { FeatureReport, FeatureReportEntry, IdentityVerificationStatus } from '@/types/capabilities'

type KycQuestions = paths['/users/kyc/questions']['get']['responses'][200]['content']['application/json']
type KycUserRead = (user: IUserProfile | null) => unknown

const POLICY_VERSION = 'code-2026-10-28'
const VERIFICATION_ID = '6f1c2a7e-3b4d-4e8f-9a0b-1c2d3e4f5a6b'

const CANONICAL_STATUS: Record<IdentityVerificationStatus, string | null> = {
    not_started: null,
    processing: 'IN_REVIEW',
    action_required: 'ACTION_REQUIRED',
    failed: 'REJECTED',
    verified: 'APPROVED',
}

const residenceOf = (user: IUserProfile | null) =>
    user?.residence?.verified?.country ?? user?.residence?.declared?.country ?? null

function nameOf(user: IUserProfile | null) {
    const fullName = user?.user.fullName ?? ''
    const [first = '', ...rest] = fullName.split(' ')
    return { fullName, first, last: rest.join(' ') }
}

// A feature the user picked and their residence opens; `ready` is one they can still add.
const opened = (entry: FeatureReportEntry | undefined) =>
    !!entry && entry.state !== 'ready' && entry.state !== 'refused'

export function kycFeatures(user: IUserProfile | null): { features: FeatureReport | undefined } {
    return { features: user?.capabilities?.features }
}

export function kycPlan(user: IUserProfile | null): Required<KycDocumentPlan> {
    const report = user?.capabilities?.features
    return {
        available: false,
        activeAttemptId: null,
        policyVersion: POLICY_VERSION,
        features: {
            qr: opened(report?.qr),
            local: opened(report?.local),
            card: opened(report?.card),
            bank: opened(report?.bank),
        },
        routes: [],
        flow: null,
        needs: [],
        proofOfAddress: null,
        proofOfAddressReason: null,
        proofOfAddressIdCountries: [],
        documentRefusals: {},
        documentTypeRefusals: {},
        temporaryProtection: null,
    }
}

export function kycQuestions(user: IUserProfile | null): KycQuestions {
    return {
        available: false,
        attemptId: null,
        residence: residenceOf(user),
        steps: [],
        firstUnanswered: null,
        progress: { done: 0, total: 0 },
        needs: [],
        closed: [],
    }
}

export function kycProfile(user: IUserProfile | null): KycProfile {
    const status = user?.identityVerification?.status ?? 'not_started'
    const canonicalStatus = CANONICAL_STATUS[status]
    const name = nameOf(user)
    return {
        residence: {
            verified: user?.residence?.verified ?? null,
            declared: user?.residence?.declared ?? null,
            secondaryDeclaredCountry: user?.residence?.secondaryDeclaredCountry ?? null,
        },
        geo: user?.geo ?? null,
        user: {
            email: user?.user.email ?? '',
            firstName: name.first,
            lastName: name.last,
            fullName: name.fullName,
        },
        identity: canonicalStatus
            ? { status, verificationId: VERIFICATION_ID, applicantId: 'demo-applicant', canonicalStatus }
            : null,
        attempts: [],
        providerAccounts: [],
    }
}

// Only answers every profile-details fixture also gives, so a fixture's own answers never mix with these.
export function kycDetails(user: IUserProfile | null): KycCollectedDetails {
    const name = nameOf(user)
    return {
        name: { first: name.first, last: name.last },
        nationality: 'BR',
        idNationality: 'BR',
        document: { type: 'ID_CARD', country: 'BRA' },
        stored: {
            dateOfBirth: '1992-03-18',
            countryOfBirth: 'BR',
            cityOfBirth: 'São Paulo',
            phone: '+5511987654321',
            occupation: 'software_developer_applications',
            annualSalary: '25k_50k',
            expectedMonthlyVolume: '1k_5k',
            cardPurpose: 'personal_spending',
        },
        heldBySumsub: ['address', 'taxId'],
    }
}

export const KYC_USER_READS: Readonly<Record<string, KycUserRead>> = {
    'GET /users/kyc/features': kycFeatures,
    'GET /users/kyc/plan': kycPlan,
    'GET /users/kyc/questions': kycQuestions,
    'GET /users/kyc/profile': kycProfile,
    'GET /users/kyc/details': kycDetails,
}
