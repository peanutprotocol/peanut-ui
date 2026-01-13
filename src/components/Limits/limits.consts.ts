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
