export const MANTECA_DEPOSIT_ADDRESS = '0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053'

// Countries that use Manteca for bank withdrawals instead of Bridge
export const MANTECA_COUNTRIES = [
    'argentina', // ARS, USD, BRL (QR pix payments)
    'chile', // CLP
    'brazil', // BRL
    'colombia', // COP
    'panama', // PUSD
    'costa-rica', // CRC
    'guatemala', // GTQ
    // 'mexico', // MXN - Keep as Bridge (CoDi disabled)
    'philippines', // PHP
    'bolivia', // BOB
] as const

// Type for Manteca countries
export type MantecaCountry = (typeof MANTECA_COUNTRIES)[number]

// Helper function to check if a country uses Manteca
export const isMantecaCountry = (countryPath: string): boolean => {
    return MANTECA_COUNTRIES.includes(countryPath as MantecaCountry)
}
