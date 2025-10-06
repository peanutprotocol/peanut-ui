import { BRIDGE_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'
import { AccountType, StepConfig, IBankAccountDetails } from './types'

const isIBANCountry = (country: string) => {
    return BRIDGE_ALPHA3_TO_ALPHA2[country.toUpperCase()] !== undefined
}

export const getAccountType = (country: string): AccountType => {
    const upperCountry = country.toUpperCase()
    if (upperCountry === 'USA') return 'US'
    if (upperCountry === 'MX') return 'MX'
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
            isStepValid: (step: number, data: IBankAccountDetails, errors: any) => {
                switch (step) {
                    case 1:
                        return !!(data.firstName && data.lastName && !errors.firstName && !errors.lastName)
                    case 2:
                        return !!(
                            data.accountNumber &&
                            data.routingNumber &&
                            !errors.accountNumber &&
                            !errors.routingNumber
                        )
                    case 3:
                        return !!(
                            data.street &&
                            data.city &&
                            data.state &&
                            data.postalCode &&
                            !errors.street &&
                            !errors.city &&
                            !errors.state &&
                            !errors.postalCode
                        )
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
            isStepValid: (step: number, data: IBankAccountDetails, errors: any) => {
                switch (step) {
                    case 1:
                        return !!(data.firstName && data.lastName && !errors.firstName && !errors.lastName)
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
            isStepValid: (step: number, data: IBankAccountDetails, errors: any) => {
                switch (step) {
                    case 1:
                        return !!(data.firstName && data.lastName && !errors.firstName && !errors.lastName)
                    case 2:
                        return !!(data.clabe && !errors.clabe)
                    case 3:
                        return !!(
                            data.street &&
                            data.city &&
                            data.state &&
                            data.postalCode &&
                            !errors.street &&
                            !errors.city &&
                            !errors.state &&
                            !errors.postalCode
                        )
                    default:
                        return false
                }
            },
        },
    }
    return configs[accountType]
}
