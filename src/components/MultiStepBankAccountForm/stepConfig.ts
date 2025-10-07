import { FieldErrors } from 'react-hook-form'
import { AccountType, StepConfig, IBankAccountDetails } from './types'

// Common validation functions
const validatePersonalInfo = (data: IBankAccountDetails, errors: FieldErrors<IBankAccountDetails>): boolean => {
    const hasAllFields = data.firstName && data.lastName
    const hasNoErrors = !errors.firstName && !errors.lastName
    return !!(hasAllFields && hasNoErrors)
}

const validateAddress = (data: IBankAccountDetails, errors: FieldErrors<IBankAccountDetails>): boolean => {
    const hasAllFields = data.street && data.city && data.state && data.postalCode
    const hasNoErrors = !errors.street && !errors.city && !errors.state && !errors.postalCode
    return !!(hasAllFields && hasNoErrors)
}

export const getAccountType = (country: string): AccountType => {
    const upperCountry = country.toUpperCase()
    if (upperCountry === 'USA') return 'US'
    if (upperCountry === 'MX' || upperCountry === 'MEX') return 'MX'
    return 'IBAN'
}

export const getStepConfig = (accountType: AccountType): StepConfig => {
    const configs: Record<AccountType, StepConfig> = {
        US: {
            totalSteps: 3,
            getStepTitle: (step: number) => {
                const titles = [
                    'Who will receive the funds?',
                    'Where should we send the money?',
                    'Where this bank is located?',
                ]
                return titles[step - 1] || ''
            },
            isStepValid: (step: number, data: IBankAccountDetails, errors: FieldErrors<IBankAccountDetails>) => {
                switch (step) {
                    case 1:
                        return validatePersonalInfo(data, errors)
                    case 2:
                        return !!(
                            data.accountNumber &&
                            data.routingNumber &&
                            !errors.accountNumber &&
                            !errors.routingNumber
                        )
                    case 3:
                        return validateAddress(data, errors)
                    default:
                        return false
                }
            },
        },
        IBAN: {
            totalSteps: 2,
            getStepTitle: (step: number) => {
                const titles = ['Who will receive the funds?', 'Where should we send the money?']
                return titles[step - 1] || ''
            },
            isStepValid: (step: number, data: IBankAccountDetails, errors: FieldErrors<IBankAccountDetails>) => {
                switch (step) {
                    case 1:
                        return validatePersonalInfo(data, errors)
                    case 2:
                        return !!(data.accountNumber && data.bic && !errors.accountNumber && !errors.bic)
                    default:
                        return false
                }
            },
        },
        MX: {
            totalSteps: 3,
            getStepTitle: (step: number) => {
                const titles = [
                    'Who will receive the funds?',
                    'Where should we send the money?',
                    'Where this bank is located?',
                ]
                return titles[step - 1] || ''
            },
            isStepValid: (step: number, data: IBankAccountDetails, errors: FieldErrors<IBankAccountDetails>) => {
                switch (step) {
                    case 1:
                        return validatePersonalInfo(data, errors)
                    case 2:
                        return !!(data.clabe && !errors.clabe)
                    case 3:
                        return validateAddress(data, errors)
                    default:
                        return false
                }
            },
        },
    }
    return configs[accountType]
}
