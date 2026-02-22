export type Locale = 'en' | 'es-419' | 'es-ar' | 'es-es' | 'pt-br'

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es-419', 'es-ar', 'es-es', 'pt-br']
export const DEFAULT_LOCALE: Locale = 'en'

export interface Translations {
    // Hero / CTA
    sendMoneyTo: string // "Send Money to {country}"
    sendMoneyToSubtitle: string // "Fast, affordable transfers to {country} in {currency}. Better rates than banks."
    getStarted: string

    // Section titles
    howItWorks: string
    frequentlyAskedQuestions: string
    sendMoneyToOtherCountries: string

    // Steps
    stepCreateAccount: string
    stepCreateAccountDesc: string
    stepDepositFunds: string
    stepDepositFundsDesc: string // "Add money via bank transfer, {method}, or stablecoins (USDC/USDT)."
    stepSendToDesc: string // "Enter the recipient's details and confirm. They receive {currency} in minutes via {method}."

    // Blog
    readMore: string
    allArticles: string
    blog: string
    postedOn: string

    // Comparison
    feature: string
    verdict: string

    // Navigation
    home: string
    sendMoney: string

    // Converter
    convertTitle: string // "Convert {from} to {to}"
    amount: string
    liveRate: string

    // Deposit
    depositFrom: string // "Deposit from {exchange}"
    recommendedNetwork: string
    withdrawalFee: string
    processingTime: string
    troubleshooting: string

    // Hub
    hubTitle: string // "Peanut in {country}"

    // From-to corridors
    sendMoneyFromTo: string // "Send Money from {from} to {to}"

    // Receive money
    receiveMoneyFrom: string // "Receive Money from {country}"
    receiveMoneyFromDesc: string // "Get money sent to you from {country}. Fast and secure."

    // Team
    teamTitle: string // "Our Team"
    teamSubtitle: string // "The people behind Peanut."

    // Misc
    lastUpdated: string // "Last updated: {date}"
    relatedPages: string // "Related Pages"
}
