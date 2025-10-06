export type IBankAccountDetails = {
    name?: string
    firstName: string
    lastName: string
    email: string
    accountNumber: string
    bic: string
    routingNumber: string
    clabe: string
    street: string
    city: string
    state: string
    postalCode: string
    iban: string
    country: string
}

export type AccountType = 'US' | 'IBAN' | 'MX'

export interface StepConfig {
    totalSteps: number
    getStepTitle: (step: number) => string
    isStepValid: (step: number, data: IBankAccountDetails, errors: any) => boolean
}
