import { countryData } from '@/components/AddMoney/consts'
import { SUPPLEMENTAL_RESIDENCE_OPTIONS } from '@/constants/residence.consts'
import { localizedCountryTitle } from '@/utils/country-name.utils'

export interface ResidenceCountryOption {
    label: string
    value: string
}

/**
 * The one residence country list: the add-money destination catalog plus the
 * supplemental sanctioned countries it omits (so restricted residents can
 * answer truthfully), localized and locale-sorted. Shared by the signup
 * residence step and the residence change modal so the two can never drift.
 */
export function buildResidenceCountryOptions(locale: string): ResidenceCountryOption[] {
    const options = countryData
        .filter((c) => c.type === 'country' && !!c.iso2)
        .map((c) => ({
            label: localizedCountryTitle(locale, { iso2: c.iso2!.toUpperCase(), title: c.title }),
            value: c.iso2!.toUpperCase(),
        }))
    const present = new Set(options.map((option) => option.value))
    for (const extra of SUPPLEMENTAL_RESIDENCE_OPTIONS) {
        if (!present.has(extra.iso2)) {
            options.push({
                label: localizedCountryTitle(locale, { iso2: extra.iso2, title: extra.title }),
                value: extra.iso2,
            })
        }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label, locale))
}
