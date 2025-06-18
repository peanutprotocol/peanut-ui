// this enum should match the one on the backend
export enum BridgeEndorsementType {
    BASE = 'base',
    SEPA = 'sepa',
    SPEI = 'spei',
}

// this type represents the detailed response from our initiate-kyc endpoint
export interface InitiateKycResponse {
    kycLink: string
    tosLink?: string
    kycStatus: string
    tosStatus?: string
    error?: string // will be present on rejections
    reasons?: Array<{
        developer_reason: string
        reason: string // this one is safe to show to the user
        created_at: string
    }>
}

// matches the BridgeAccountType enum on the backend
export enum BridgeAccountType {
    IBAN = 'iban',
    US = 'us',
    CLABE = 'clabe',
}

// matches the BridgeAccountOwnerType enum on the backend
export enum BridgeAccountOwnerType {
    INDIVIDUAL = 'individual',
    BUSINESS = 'business',
}

// defines the payload for the new add-bank-account endpoint
export interface AddBankAccountPayload {
    accountType: BridgeAccountType
    accountNumber: string
    countryCode: string
    countryName: string
    accountOwnerType: BridgeAccountOwnerType
    accountOwnerName: {
        firstName?: string
        lastName?: string
        businessName?: string
    }
    address: {
        street: string
        city: string
        country: string
        state?: string
        postalCode: string
    }
    bic?: string
    routingNumber?: string
}
