import { OTHER_SUPPORTED_CHAINS, SUPPORTED_EVM_CHAINS } from '@/constants/rhino.consts'
import { getTranslations, t } from '@/i18n'
import { type Locale } from '@/i18n/types'
import { chainDisplayName } from '@/utils/chain-display.utils'
import { localizedCountryName } from '@/utils/country-name.utils'
import { DEPOSIT_RAILS, DEPOSIT_RAIL_ORDER } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import type { FiatRailListing } from '@/components/LandingPage/landing.types'

/**
 * The "which networks, tokens and banks?" landing FAQ item. Question, fiat-rail
 * facts and plain-text answer live here (server-safe, feeds the FAQPage JSON-LD
 * via getLandingContent); the rich chip UI is rendered by SupportedRailsFaqAnswer,
 * matched by id. Chain names derive from rhino.consts and the bank rails from the
 * deposit corridor catalogue (DEPOSIT_RAILS), so the public answer and the
 * on-page UI list exactly the corridors the app offers.
 */
export const SUPPORTED_RAILS_FAQ_ID = 'supported-rails'

/**
 * The rail name a reader recognises for each corridor. Keyed by corridor, so a
 * corridor added to DEPOSIT_RAILS fails the typecheck until it has a name here.
 * Proper nouns, so they are the same in every locale.
 */
const PUBLIC_RAIL_NAMES: Record<DepositCorridor, string> = {
    SEPA_EU: 'SEPA',
    FASTER_PAYMENTS_GB: 'Faster Payments',
    ACH_US: 'ACH & Wire',
    SPEI_MX: 'SPEI',
    BANK_TRANSFER_CO: 'Bre-B',
    PIX_BR: 'Pix',
    BANK_TRANSFER_AR: 'Mercado Pago',
}

// The euro corridor serves the whole SEPA zone, which has no ISO country code.
// UN M.49 "150" is Europe, which Intl.DisplayNames names in every locale. No
// country count: product/countries.md leaves the SEPA count unresolved.
const EURO_CORRIDOR_REGION = '150'

/** "mx" → 🇲🇽, "eu" → 🇪🇺: two regional-indicator symbols. */
function flagEmoji(iso2: string): string {
    return String.fromCodePoint(...[...iso2.toUpperCase()].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65))
}

/** The bank rails the landing FAQ lists, in the app's corridor order, with the region in the reader's language. */
export function supportedFiatRails(locale: Locale): FiatRailListing[] {
    return DEPOSIT_RAIL_ORDER.map((corridor) => {
        const rail = DEPOSIT_RAILS[corridor]
        const regionCode = rail.flagIso2 === 'eu' ? EURO_CORRIDOR_REGION : rail.flagIso2.toUpperCase()
        return {
            corridor,
            flag: flagEmoji(rail.flagIso2),
            name: PUBLIC_RAIL_NAMES[corridor],
            currency: rail.currency,
            region: localizedCountryName(locale, regionCode, regionCode),
        }
    })
}

const EVM_CHAIN_LIST = SUPPORTED_EVM_CHAINS.map(chainDisplayName).join(', ')

export function supportedRailsFaq(locale: Locale): { question: string; answer: string } {
    const translations = getTranslations(locale)
    return {
        question: translations.landingSupportedRailsFaqQuestion,
        answer: t(translations.landingSupportedRailsFaqAnswer, {
            evmCount: String(SUPPORTED_EVM_CHAINS.length),
            evmList: EVM_CHAIN_LIST,
            otherList: OTHER_SUPPORTED_CHAINS.map(chainDisplayName).join(` ${translations.listJoinAnd} `),
            railList: supportedFiatRails(locale)
                .map((rail) => `${rail.name} (${rail.currency}, ${rail.region})`)
                .join(', '),
        }),
    }
}
