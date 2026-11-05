/** The API handed this user back to today's flow (409 existing_verification); that flow starts from Home. */
export class KycFlowHandedBackError extends Error {
    constructor() {
        super('KYC flow handed back')
        this.name = 'KycFlowHandedBackError'
    }
}

export const isKycFlowHandedBack = (error: unknown): error is KycFlowHandedBackError =>
    error instanceof KycFlowHandedBackError
