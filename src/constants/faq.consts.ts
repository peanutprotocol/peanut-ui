import { SUPPORTED_EVM_CHAINS } from '@/constants/rhino.consts'

/**
 * The "which networks, tokens and banks?" landing FAQ item. Question + plain-text
 * answer live here (server-safe, feeds the FAQPage JSON-LD via getLandingContent);
 * the rich chip UI is rendered client-side by SupportedRailsFaqAnswer, matched by id.
 * Chain names derive from rhino.consts so this can never drift from what the
 * add-money flow actually supports.
 */
export const SUPPORTED_RAILS_FAQ_ID = 'supported-rails'

// Display labels where plain title-case reads wrong.
const CHAIN_DISPLAY_OVERRIDES: Record<string, string> = {
    BNB: 'BNB Chain',
}

export const chainDisplayName = (chain: string): string =>
    CHAIN_DISPLAY_OVERRIDES[chain] ?? chain.charAt(0) + chain.slice(1).toLowerCase()

const EVM_CHAIN_LIST = SUPPORTED_EVM_CHAINS.map(chainDisplayName).join(', ')

export const SUPPORTED_RAILS_FAQ_QUESTION = 'Which networks, tokens and banks does Peanut support?'

export const SUPPORTED_RAILS_FAQ_ANSWER =
    `Crypto: deposit and withdraw USDC and USDT on ${SUPPORTED_EVM_CHAINS.length} EVM networks with a single address (${EVM_CHAIN_LIST}), plus Solana (USDC, USDT) and Tron (USDT only). ETH is also supported on EVM networks. ` +
    'Banks: US bank transfers (ACH and wire, USD), SEPA (EUR, 36 countries), UK Faster Payments (GBP) and Mexico SPEI (MXN). ' +
    'Local payment apps: Mercado Pago in Argentina and Pix in Brazil. Deposits are free — Peanut covers the gas.'
