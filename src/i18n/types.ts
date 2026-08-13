// Matches the app UI's locale set (src/i18n/app/config.ts APP_LOCALES). Lowercase
// pt-br/es-ar are URL-facing and already indexed — HREFLANG_MAP emits the
// pt-BR/es-AR tags.
export type Locale = 'en' | 'es-419' | 'es-ar' | 'pt-br'

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es-419', 'es-ar', 'pt-br']
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

    // Press
    pressTitle: string // "Press & Brand Kit"
    pressSubtitle: string // "Everything you need to write or design about Peanut."

    // Help center
    help: string // "Help"
    helpCenter: string // "Help Center"
    helpCenterDescription: string // "Get help with Peanut — ..."
    searchHelpArticles: string // "Search help articles..."
    cantFindAnswer: string // "Can't find what you need?"
    cantFindAnswerDesc: string // "Click the chat bubble..."
    categoryGettingStarted: string
    categoryAccountSecurity: string
    categoryPayments: string
    categoryDepositsWithdrawals: string
    categorySendingReceiving: string
    categoryTroubleshooting: string

    // Landing page — shared chrome
    landingSignUp: string
    landingLearnMore: string

    // Landing page — "global cash, local feel" section
    landingGlobalCashLine1: string
    landingGlobalCashLine2: string
    landingGlobalCashStats: string
    landingGlobalCashBody: string

    // Landing page — regulated rails section
    landingRailsHeading: string
    landingRailsBody: string
    landingWorksWith: string

    // Landing page — pay-like-a-local (QR/PIX) section
    landingPayLocalHeading: string
    landingPayLocalSubheading: string
    landingPayLocalBody: string
    landingPayLocalSettles: string
    landingMercadoPagoAria: string
    landingPixAria: string

    // Landing page — security section
    landingSecurityHeading: string
    landingSecurityTotalTitle: string
    landingSecurityTotalDesc: string
    landingSecurityControlTitle: string
    landingSecurityControlDesc: string
    landingSecurityHelpTitle: string
    landingSecurityHelpDesc: string
    landingTalkToSupport: string

    // Landing page — send-in-seconds section
    landingSendTagline1: string
    landingSendTagline2: string

    // Landing page — hero
    landingHeroTapScan: string
    landingHeroNoLocalId: string

    // Landing page — zero-fees section
    landingZeroFees: string
    landingSeeMarkupOn: string

    // Landing page — drop-a-link section
    landingDropLinkHeading: string
    landingDropLinkBody: string

    // Landing page — CTAs and inputs
    landingSendNow: string
    landingSignUpNow: string

    // Landing page — card beat (closed-beta card, /shhhhh door)
    // The bridge line and the body wrap inline elements (a /setup link, the
    // scarcity counter), so each is split around the element it wraps.
    landingCardBeatBridgeBefore: string
    landingCardBeatBridgeLink: string
    landingCardBeatBridgeAfter: string
    landingCardBeatKicker: string
    landingCardBeatHeading: string
    landingCardBeatTagline: string
    landingCardBeatBodyBefore: string
    landingCardBeatCounterLabel: string // "only {count}"
    landingCardBeatBodyAfter: string
    landingCardBeatCustody: string
    landingCardBeatTrust: string
    landingCardBeatWaitlistLink: string
    landingCardBeatStatMerchants: string
    landingCardBeatStatBalance: string
    landingCardBeatStatCard: string
    landingCardBeatStatMonthlyFees: string
    landingTryTheDoor: string // shared by the card beat, the ending beat and the sticky bar

    // Landing page — manifesto beat
    landingManifestoHeading: string
    landingManifestoSubline: string

    // Landing page — problem beat (the pointer arrow is drawn by the component)
    landingProblemHeading: string
    landingProblemProse: string
    landingProblemPointerPassport: string
    landingProblemPointerRate: string
    landingProblemPointerMoneyOut: string

    // Landing page — what-works-today beat
    landingWorksTodayHeading: string
    landingWorksTodaySubline: string
    landingWorksTodayPayLocalTitle: string
    landingWorksTodayMoneyOut: string
    landingWorksTodayChipEurPix: string
    landingWorksTodayChipUsdMercadoPago: string
    landingWorksTodayDropLinkTitle: string
    landingWorksTodayRateTitle: string
    landingWorksTodaySecurityTitle: string
    landingWorksTodaySecurityBody: string

    // Landing page — ending beat
    landingNotForYouHeading: string
    landingNotForYouBody: string
    landingNotForYouSignUpLink: string

    // Landing page — marquee strips
    landingMarqueeClosedBeta: string
    landingMarqueeShhhh: string
    landingMarqueeWordTravels: string
    landingMarqueeInstant: string
    landingMarquee247: string
    landingMarqueeUsd: string
    landingMarqueeEur: string
    landingMarqueeStablecoins: string
    landingMarqueeGlobal: string
    landingMarqueeSelfCustodial: string

    // Legal page headers (privacy/terms carry no <Hero> in their verbatim markdown)
    legalHeroSubtitlePrivacy: string
    legalHeroSubtitleTerms: string

    // Exchange-rate widget (marketing surfaces)
    exchangeYouSend: string
    exchangeRecipientGets: string
    exchangeSwapCurrencies: string
    exchangeRateUnavailable: string
    exchangeBankFee: string
    exchangePeanutFee: string
    exchangeFree: string
    exchangeArrivesHours: string
    exchangeArrivesMinutes: string

    // Footer
    footerMadeWithLove: string
    footerLegalEntity: string
    footerSupport: string
    footerDocs: string
    footerTerms: string
    footerPrivacy: string
    footerSecurity: string
    footerJobs: string

    // MDX component headings
    faqTitle: string

    // Marketing hero marquee
    heroMarqueeNoFees: string
    heroMarqueeInstant: string
    heroMarqueeDollars: string

    // Stories hub
    storiesTitle: string
    storiesSubtitle: string
    stories: string
    noStoriesPublished: string

    // Error boundaries
    errorSomethingWentWrong: string
    errorPageLoadBody: string
    errorTryAgain: string
    errorGoHome: string
    errorContentUnavailable: string
    errorTryRefreshing: string

    footerLanguage: string

    // Locale suggestion banner (shown in the language being offered)
    localeSuggestionText: string
    localeSuggestionCta: string
    localeSuggestionDismiss: string

    // Footer — SEO site directory
    footerSiteDirectory: string
    footerCompare: string
    footerLearnMoreSection: string
    footerResources: string
    footerSendTo: string // "Send to {name}"
    footerSendFrom: string // "Send from {name}"
    footerPeanutVs: string // "Peanut vs {name}"

    // Misc
    lastUpdated: string // "Last updated: {date}"
    relatedPages: string // "Related Pages"

    // Content hub
    content: string // "Content" (nav label)
    contentHubTitle: string
    contentHubSubtitle: string
    contentSearchPlaceholder: string
    filterAll: string
    filterBlog: string
    filterStories: string
    filterUseCases: string
    filterCompare: string
    noContentResults: string
    backTo: string // "Back to {name}"
}
