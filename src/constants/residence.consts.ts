/**
 * countryData is the add-money DESTINATION list and deliberately omits
 * sanctioned countries. The residence question must list every country, or a
 * restricted resident cannot answer truthfully and never sees the honest
 * heads-up. These fill the gap in the selector only.
 */
export const SUPPLEMENTAL_RESIDENCE_OPTIONS: ReadonlyArray<{ iso2: string; title: string }> = [
    { iso2: 'CU', title: 'Cuba' },
    { iso2: 'IR', title: 'Iran' },
    { iso2: 'KP', title: 'North Korea' },
    { iso2: 'MM', title: 'Myanmar' },
    { iso2: 'RU', title: 'Russia' },
    { iso2: 'SY', title: 'Syria' },
]
