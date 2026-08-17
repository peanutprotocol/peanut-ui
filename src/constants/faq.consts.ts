import { OTHER_SUPPORTED_CHAINS, SUPPORTED_EVM_CHAINS } from '@/constants/rhino.consts'
import { getTranslations, t } from '@/i18n'
import { type Locale } from '@/i18n/types'
import { chainDisplayName } from '@/utils/chain-display.utils'

/**
 * The "which networks, tokens and banks?" landing FAQ item. Question, fiat-rail
 * facts and plain-text answer live here (server-safe, feeds the FAQPage JSON-LD
 * via getLandingContent); the rich chip UI is rendered client-side by
 * SupportedRailsFaqAnswer, matched by id. Chain names derive from rhino.consts
 * and the visible rails render from FIAT_RAILS, so the public answer and the
 * on-page UI share one source and can't drift from what the app supports.
 */
export const SUPPORTED_RAILS_FAQ_ID = 'supported-rails'

export const FIAT_RAILS = [
    { flag: '🇺🇸', name: 'ACH & Wire', currency: 'USD', region: 'United States' },
    { flag: '🇪🇺', name: 'SEPA', currency: 'EUR', region: '36 countries' },
    { flag: '🇬🇧', name: 'Faster Payments', currency: 'GBP', region: 'United Kingdom' },
    { flag: '🇲🇽', name: 'SPEI', currency: 'MXN', region: 'Mexico' },
    { flag: '🇦🇷', name: 'Mercado Pago', currency: 'ARS', region: 'Argentina' },
    { flag: '🇧🇷', name: 'Pix', currency: 'BRL', region: 'Brazil' },
] as const

const EVM_CHAIN_LIST = SUPPORTED_EVM_CHAINS.map(chainDisplayName).join(', ')
const FIAT_RAIL_LIST = FIAT_RAILS.map((rail) => `${rail.name} (${rail.currency}, ${rail.region})`).join(', ')

export function supportedRailsFaq(locale: Locale): { question: string; answer: string } {
    const translations = getTranslations(locale)
    return {
        question: translations.landingSupportedRailsFaqQuestion,
        answer: t(translations.landingSupportedRailsFaqAnswer, {
            evmCount: String(SUPPORTED_EVM_CHAINS.length),
            evmList: EVM_CHAIN_LIST,
            otherList: OTHER_SUPPORTED_CHAINS.map(chainDisplayName).join(` ${translations.listJoinAnd} `),
            railList: FIAT_RAIL_LIST,
        }),
    }
}
