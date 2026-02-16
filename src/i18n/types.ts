export type Locale = 'en' | 'es' | 'pt'

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'pt']
export const DEFAULT_LOCALE: Locale = 'en'

export interface Translations {
    // Hero / CTA
    sendMoneyTo: string // "Send Money to {country}"
    sendMoneyToSubtitle: string // "Fast, affordable transfers to {country} in {currency}. Better rates than banks."
    getStarted: string
    createAccount: string

    // Section titles
    howItWorks: string
    paymentMethods: string
    frequentlyAskedQuestions: string
    sendMoneyToOtherCountries: string
    sendingMoneyTo: string // "Sending Money to {country}"

    // Steps
    stepCreateAccount: string
    stepCreateAccountDesc: string
    stepDepositFunds: string
    stepDepositFundsDesc: string // "Add money via bank transfer, {method}, or stablecoins (USDC/USDT)."
    stepSendTo: string // "Send to {country}"
    stepSendToDesc: string // "Enter the recipient's details and confirm. They receive {currency} in minutes via {method}."

    // Payment methods
    instantDeposits: string // "Instant deposits and payments via {method} in {country}."
    qrPayments: string
    stablecoins: string
    stablecoinsDesc: string
    bankTransfer: string
    bankTransferDesc: string

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
    hubSubtitle: string // "Everything you need to send, receive, and spend money in {country}."
    hubSendMoney: string // "Send Money to {country}"
    hubSendMoneyDesc: string // "Transfer money to {country} with competitive rates."
    hubConvert: string // "Convert to {currency}"
    hubConvertDesc: string // "See live rates and convert currencies."
    hubDeposit: string // "Fund Your Account"
    hubDepositDesc: string // "Add money from popular exchanges and wallets."
    hubCompare: string // "Compare Services"
    hubCompareDesc: string // "See how Peanut compares to other options."
    hubExploreCountries: string // "Explore other countries"
    hubInboundCorridors: string // "Send money to {country} from these countries:"
    hubSendMoneyFrom: string // "Send Money from {country}"

    // From-to corridors
    sendMoneyFromTo: string // "Send Money from {from} to {to}"
    sendMoneyFromToDesc: string // "Transfer money from {from} to {to}. Fast, affordable, and secure."
    fromToContext: string // "Peanut makes it easy to send money from {from} to {to}."

    // Receive money
    receiveMoneyFrom: string // "Receive Money from {country}"
    receiveMoneyFromDesc: string // "Get money sent to you from {country}. Fast and secure."

    // Pay with
    payWith: string // "Pay with {method}"
    payWithDesc: string // "Use {method} to send and receive money on Peanut."

    // Team
    teamTitle: string // "Our Team"
    teamSubtitle: string // "The people behind Peanut."

    // Misc
    lastUpdated: string // "Last updated: {date}"
    relatedPages: string // "Related Pages"
}
