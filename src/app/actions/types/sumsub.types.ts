export interface InitiateSumsubKycResponse {
    token: string | null // null when user is already APPROVED
    applicantId: string | null
    status: SumsubKycStatus
}

export type SumsubKycStatus = 'NOT_STARTED' | 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED'

export type KYCRegionIntent = 'STANDARD' | 'LATAM'
