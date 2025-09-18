import { countryData, countryCodeMap } from '@/components/AddMoney/consts'

/**
 * Extracts the country name from an IBAN by parsing the first 2 characters (country code)
 * @param iban - The IBAN string (with or without spaces)
 * @returns The country name if found, null if invalid IBAN or country not found
 */
export const getCountryFromIban = (iban: string): string | null => {
    // Remove spaces and convert to uppercase
    const cleanIban = iban.replace(/\s/g, '').toUpperCase()

    // Extract the first 2 characters as country code
    const countryCode = cleanIban.substring(0, 2)

    // Try to find country by 2-letter code directly in countryData
    let country = countryData.find((c) => c.type === 'country' && (c.id === countryCode || c.iso2 === countryCode))

    // If not found, get the 3-letter code and try that
    if (!country) {
        const threeLetterCode = getCountryCodeForWithdraw(countryCode)
        if (threeLetterCode !== countryCode) {
            country = countryData.find((c) => c.type === 'country' && c.id === threeLetterCode)
        }
    }

    return country ? country.path : null
}

/**
 * Validates a US bank account number with comprehensive checks
 * @param accountNumber - The bank account number to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export const validateUSBankAccount = (accountNumber: string) => {
    // Remove spaces and hyphens for validation
    const cleanAccountNumber = accountNumber.replace(/[\s-]/g, '')

    // Check if contains only digits
    if (!/^\d+$/.test(cleanAccountNumber)) {
        return {
            isValid: false,
            error: 'Account number must contain only digits',
        }
    }

    // Check minimum length (US bank accounts are typically 6-17 digits)
    if (cleanAccountNumber.length < 6) {
        return {
            isValid: false,
            error: 'Account number must be at least 6 digits',
        }
    }

    // Check maximum length
    if (cleanAccountNumber.length > 17) {
        return {
            isValid: false,
            error: 'Account number cannot exceed 17 digits',
        }
    }

    // Check for obviously invalid patterns
    if (/^0+$/.test(cleanAccountNumber)) {
        return {
            isValid: false,
            error: 'Account number cannot be all zeros',
        }
    }

    return {
        isValid: true,
        error: null,
    }
}

/**
 * Validates a Mexican CLABE (Clave Bancaria Estandarizada) account number
 * CLABE is exactly 18 digits with a specific structure and check digit validation
 * @param accountNumber - The CLABE account number to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export const validateMXCLabeAccount = (accountNumber: string) => {
    // Remove spaces and hyphens for validation
    const cleanAccountNumber = accountNumber.replace(/[\s-]/g, '')

    // Check if contains only digits
    if (!/^\d+$/.test(cleanAccountNumber)) {
        return {
            isValid: false,
            error: 'CLABE must contain only digits',
        }
    }

    // CLABE must be exactly 18 digits
    if (cleanAccountNumber.length !== 18) {
        return {
            isValid: false,
            error: 'CLABE must be exactly 18 digits',
        }
    }

    // Check for obviously invalid patterns
    if (/^0+$/.test(cleanAccountNumber)) {
        return {
            isValid: false,
            error: 'CLABE cannot be all zeros',
        }
    }

    // Validate CLABE check digit using the official algorithm
    const digits = cleanAccountNumber.split('').map(Number)
    const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7]

    let sum = 0
    for (let i = 0; i < 17; i++) {
        sum += digits[i] * weights[i]
    }

    const remainder = sum % 10
    const calculatedCheckDigit = remainder === 0 ? 0 : 10 - remainder
    const providedCheckDigit = digits[17]

    if (calculatedCheckDigit !== providedCheckDigit) {
        return {
            isValid: false,
            error: 'CLABE check digit is invalid',
        }
    }

    return {
        isValid: true,
        error: null,
    }
}

// Returns the 3-letter country code for the given country code
export const getCountryCodeForWithdraw = (country: string) => {
    // If the input is already a 3-digit code and exists in the map, return it
    if (countryCodeMap[country]) {
        return country
    }

    // If the input is a 2-digit code, find the corresponding 3-digit code
    const threeDigitCode = Object.keys(countryCodeMap).find((key) => countryCodeMap[key] === country)

    return threeDigitCode || country
}

function checkBlock(block: string, weights: number[]) {
    let sum = 0
    for (let i = 0; i < block.length; i++) {
        sum += parseInt(block[i]) * weights[i]
    }
    const remainder = sum % 10
    return remainder === 0 ? 0 : 10 - remainder
}

export function validateCbuCvuAlias(value: string): { valid: boolean; message?: string } {
    value = value.trim()
    const length = value.length
    if ((length < 6 || length > 20) && length !== 22) {
        return { valid: false, message: 'Invalid length' }
    }

    // CBU and CVU case
    if (length === 22) {
        // contains non-numeric characters?
        if (/\D/.test(value)) {
            return { valid: false, message: 'CBU/CVU must contain only numbers' }
        }

        const firstBlock = value.substring(0, 7)
        const firstCheck = value[7]
        const secondBlock = value.substring(8, 21)
        const secondCheck = value[21]

        const expectedFirst = checkBlock(firstBlock, [7, 1, 3, 9, 7, 1, 3]).toString()
        const expectedSecond = checkBlock(secondBlock, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]).toString()

        if (expectedFirst !== firstCheck || expectedSecond !== secondCheck) {
            return { valid: false, message: 'Invalid CBU/CVU check that you entered it correctly' }
        }
        return { valid: true }
    }

    // Alias case
    if (!/^[a-z/d\.-]*$/i.test(value)) {
        return { valid: false, message: 'Alias must contain only letters, numbers, dots, and dashes' }
    }

    return { valid: true }
}
