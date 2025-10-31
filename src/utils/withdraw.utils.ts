import { countryData, ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '@/components/AddMoney/consts'

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
    if (ALL_COUNTRIES_ALPHA3_TO_ALPHA2[country]) {
        return country
    }

    // If the input is a 2-digit code, find the corresponding 3-digit code
    const threeDigitCode = Object.keys(ALL_COUNTRIES_ALPHA3_TO_ALPHA2).find(
        (key) => ALL_COUNTRIES_ALPHA3_TO_ALPHA2[key] === country
    )

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
    //TODO: enable this again when alias is supported
    //if ((length < 6 || length > 20) && length !== 22) {
    if (length !== 22) {
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

/**
 * Detects if a PIX key is a phone number format
 * @param pixKey - The PIX key to check
 * @returns true if it's a phone number format (with or without +)
 */
export const isPixPhoneNumber = (pixKey: string): boolean => {
    const cleaned = pixKey.replace(/[\s-]/g, '')
    // Matches +5511999999999 or 5511999999999 (country code 55 + 10-11 digits)
    return /^(\+)?55\d{10,11}$/.test(cleaned)
}

/**
 * Normalizes a PIX phone number by adding the "+" prefix if missing
 * @param pixKey - The PIX key to normalize
 * @returns The normalized PIX key with "+" prefix if it's a phone number
 */
export const normalizePixPhoneNumber = (pixKey: string): string => {
    const cleaned = pixKey.replace(/[\s-]/g, '')
    if (isPixPhoneNumber(cleaned) && !cleaned.startsWith('+')) {
        return '+' + cleaned
    }
    return pixKey
}

/**
 * Validates if a string is a valid EMVCo PIX QR code
 * @param pixKey - The PIX key to validate
 * @returns true if it's a valid EMVCo QR code format
 */
export const isPixEmvcoQr = (pixKey: string): boolean => {
    // EMVCo QR codes start with "000201" and contain "br.gov.bcb.pix"
    return pixKey.startsWith('000201') && pixKey.includes('br.gov.bcb.pix')
}

/**
 * Validates a PIX key based on Brazilian Central Bank standards
 * Supports: Phone, CPF, CNPJ, Email, Random Key (UUID), and EMVCo QR Code
 * @param pixKey - The PIX key to validate
 * @returns Object with valid boolean and error message if invalid
 */
export const validatePixKey = (pixKey: string): { valid: boolean; message?: string } => {
    const trimmed = pixKey.trim()

    if (!trimmed) {
        return { valid: false, message: 'PIX key cannot be empty' }
    }

    // 1. Phone Number: +5511999999999 or 5511999999999 (country code 55 + 10-11 digits)
    if (isPixPhoneNumber(trimmed)) {
        const cleaned = trimmed.replace(/[\s-]/g, '')
        const digits = cleaned.replace('+', '')
        if (digits.length < 12 || digits.length > 13) {
            return { valid: false, message: 'Invalid phone number format' }
        }
        return { valid: true }
    }

    // 2. CPF: 11 digits
    const cleanedDigits = trimmed.replace(/[\s.-]/g, '')
    if (/^\d{11}$/.test(cleanedDigits) && !trimmed.includes('@')) {
        // Basic CPF validation (not checking verifier digits)
        if (/^(\d)\1{10}$/.test(cleanedDigits)) {
            return { valid: false, message: 'Invalid CPF (all digits are the same)' }
        }
        return { valid: true }
    }

    // 3. CNPJ: 14 digits
    if (/^\d{14}$/.test(cleanedDigits)) {
        // Basic CNPJ validation (not checking verifier digits)
        if (/^(\d)\1{13}$/.test(cleanedDigits)) {
            return { valid: false, message: 'Invalid CNPJ (all digits are the same)' }
        }
        return { valid: true }
    }

    // 4. Email: Standard email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (emailRegex.test(trimmed)) {
        if (trimmed.length > 77) {
            return { valid: false, message: 'Email is too long (max 77 characters)' }
        }
        return { valid: true }
    }

    // 5. Random Key (UUID): Standard UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(trimmed)) {
        return { valid: true }
    }

    // 6. EMVCo QR Code: Full QR code string
    if (isPixEmvcoQr(trimmed)) {
        if (trimmed.length < 50 || trimmed.length > 500) {
            return { valid: false, message: 'Invalid QR code length' }
        }
        return { valid: true }
    }

    return {
        valid: false,
        message: 'Invalid PIX key format. Must be phone, CPF, CNPJ, email, random key, or QR code',
    }
}
