export type KycActionType = 'manteca' | 'bridge-direct'

export interface InitiateSumsubKycResponse {
    token: string | null // null when user is already APPROVED or bridge-direct
    applicantId: string | null
    status: SumsubKycStatus
    actionType?: KycActionType // present for cross-region responses
}

export type SumsubKycStatus =
    | 'NOT_STARTED'
    | 'PENDING'
    | 'IN_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'ACTION_REQUIRED'
    | 'REVERIFYING'

export type KYCRegionIntent = 'STANDARD' | 'LATAM'
