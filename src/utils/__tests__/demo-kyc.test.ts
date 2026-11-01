import { DEMO_USER } from '@/constants/demo-data'
import type { IUserProfile } from '@/interfaces/interfaces'
import { kycPlan, kycProfile, kycQuestions } from '@/utils/demo-kyc'

const withUser = (patch: Partial<IUserProfile>): IUserProfile => ({ ...DEMO_USER, ...patch })

describe('demo KYC reads', () => {
    it('opens the plan’s features the user picked, not the ones they can still add', () => {
        expect(kycPlan(DEMO_USER).features).toEqual({ qr: true, local: true, card: false, bank: true })
    })

    it('reads the residence and identity off the user', () => {
        const user = withUser({
            residence: {
                verified: { country: 'DE', status: 'VERIFIED', updatedAt: null },
                declared: null,
                secondaryDeclaredCountry: null,
            },
            identityVerification: { status: 'processing' },
        })
        expect(kycQuestions(user).residence).toBe('DE')
        expect(kycProfile(user).identity?.canonicalStatus).toBe('IN_REVIEW')
        expect(kycProfile(user).residence.verified?.country).toBe('DE')
    })

    it('has no identity before the user starts', () => {
        expect(kycProfile(withUser({ identityVerification: { status: 'not_started' } })).identity).toBeNull()
    })
})
