// region path to provider mapping for navigation
export const BRIDGE_REGIONS = ['europe', 'north-america', 'mexico', 'argentina', 'brazil']
export const MANTECA_REGIONS = ['latam']

// map region paths to bridge page region query param
export const REGION_TO_BRIDGE_PARAM: Record<string, string> = {
    europe: 'europe',
    'north-america': 'us',
    mexico: 'mexico',
    argentina: 'argentina',
    brazil: 'brazil',
}

// region types for url state (source region from limits page)
export type BridgeRegion = 'us' | 'mexico' | 'europe' | 'argentina' | 'brazil'

// regions that show main limits (bank transfers)
export const BANK_TRANSFER_REGIONS: BridgeRegion[] = ['us', 'mexico', 'europe']

// qr-only countries config
export const QR_COUNTRIES = [
    { id: 'argentina', name: 'Argentina', flag: 'https://flagcdn.com/w160/ar.png' },
    { id: 'brazil', name: 'Brazil', flag: 'https://flagcdn.com/w160/br.png' },
] as const

export type QrCountryId = (typeof QR_COUNTRIES)[number]['id']

export const LIMITS_PROVIDERS = ['bridge', 'manteca'] as const
export type LimitsProvider = (typeof LIMITS_PROVIDERS)[number]
