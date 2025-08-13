import { countryData, countryCodeMap } from '@/components/AddMoney/consts'

/**
 * Extracts the country name from an IBAN by parsing the first 2 characters (country code)
 * @param iban - The IBAN string (with or without spaces)
 * @returns The country name if found, null if invalid IBAN or country not found
 */
export const getCountryFromIban = (iban: string): string | null => {
    if (!iban || typeof iban !== 'string') {
        return null
    }

    // Remove spaces and convert to uppercase
    const cleanIban = iban.replace(/\s/g, '').toUpperCase()

    // Extract the first 2 characters as country code
    const countryCode = cleanIban.substring(0, 2)

    // First try to find by 2-letter country code directly
    let country = countryData.find((c) => c.type === 'country' && c.id === countryCode)

    // If not found, try to find by 3-letter code that maps to this 2-letter code
    if (!country) {
        // Find the 3-letter code that maps to our 2-letter code
        const threeLetterCode = Object.keys(countryCodeMap).find((key) => countryCodeMap[key] === countryCode)

        if (threeLetterCode) {
            country = countryData.find((c) => c.type === 'country' && c.id === threeLetterCode)
        }
    }

    return country ? country.title : null
}
