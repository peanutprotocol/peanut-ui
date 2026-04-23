// matches the BridgeAccountType enum on the backend
export enum BridgeAccountType {
    IBAN = 'iban',
    US = 'us',
    CLABE = 'clabe',
    GB = 'gb', // uk bank accounts (sort code + account number)
}

// matches the BridgeAccountOwnerType enum on the backend
export enum BridgeAccountOwnerType {
    INDIVIDUAL = 'individual',
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
    sortCode?: string // uk bank accounts
}
