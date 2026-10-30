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
    breadcrumbLabel: string // accessible name of the breadcrumb nav
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

    // Press
    pressTitle: string // "Press & Brand Kit"
    pressSubtitle: string // "Everything you need to write or design about Peanut."
    pressCompanyDescription: string // "Company description"
    pressTaglineHeadlines: string // "Tagline & headlines"
    pressBrandAssets: string // "Brand assets"
    pressTeam: string // "Team"
    pressCompany: string // "Company"
    pressMediaContact: string // "Media contact"
    pressBoilerplateShort: string // "Short"
    pressBoilerplateMedium: string // "Medium"
    pressBoilerplatePress: string // "Press / Partner"

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
    landingLogIn: string
    landingLearnMore: string

    // Landing page — pay-like-a-local (QR/PIX) heading, reused by the home fold
    landingPayLocalHeading: string

    // Landing page — home folds (c1-v3 "Balance hinge")
    landingGetPaidHeading: string
    landingPersonasHeading: string
    landingPersonaDesignerWho: string
    landingPersonaDesignerLine: string
    landingPersonaDeveloperWho: string
    landingPersonaDeveloperLine: string
    landingPersonaEditorWho: string
    landingPersonaEditorLine: string
    landingPersonaWriterWho: string
    landingPersonaWriterLine: string
    landingPersonaPhotographerWho: string
    landingPersonaPhotographerLine: string
    landingRequestHeading: string
    landingRequestRequesting: string // "{username} …"
    landingRequestPaid: string
    landingRequestChatLabel: string // "… {main} … {amount}; {payer} …"
    landingHingeHeading: string
    landingHingeBalance: string
    landingHingeActivity: string
    landingHingeMoneyIn: string
    landingHingeScreenLabel: string // "… {balance} … {eur}, {usdIn} … {merchant}: {ars}, {usdOut}."
    landingCardLockup: string // brand name, the same in every locale
    landingCardTagline: string // the h2's second sentence, after the brand name
    landingCardLine: string
    landingCardGetYourCard: string
    landingCardReceiptTitle: string
    landingCardReceiptApproved: string
    landingSeamCard: string // marquee words, "\n" between them
    landingPayLocalLead: string // "… {argentina} … {brazil} …", each slot becomes a link
    landingPayLocalArgentina: string
    landingPayLocalBrazil: string
    landingSecurityHeading: string
    landingSecurityTotalTitle: string
    landingSecurityTotalDesc: string
    landingSecurityControlTitle: string
    landingSecurityControlDesc: string
    landingSecurityHelpTitle: string
    landingSecurityHelpDesc: string
    landingTalkToSupport: string
    landingZeroFees: string // one word, set in Knerd ("ZERO")
    landingZeroFeesSr: string // read after it by screen readers only ("transfer fees"), so the h2 says what is zero
    landingReallyZero: string // uppercase; the last word gets the scribble circle
    landingNoHiddenFees: string // uppercase
    landingSeeMarkupOn: string
    landingWallOfLove: string
    landingWallOfLovePause: string // the wall's rotation control while it cycles
    landingWallOfLovePlay: string // the same control once paused
    // Marquee words for the home's seams, "\n" between the words
    landingSeamPasskey: string
    landingSeamAccounts: string
    landingSeamPersonas: string
    landingSeamLink: string
    landingSeamBalance: string
    landingSeamAccountFees: string
    landingSeamWallOfLove: string
    landingSeamFaq: string
    landingSeamClose: string
    landingSeamFooter: string
    landingFaqFootnote: string
    landingCloseTitle: string // "\n" between the Knerd lines

    // Landing page — hero
    landingHeroHeadline: string
    landingHeroSubline: string
    landingHeroGetPaid: string
    landingHeroGlobally: string
    landingHeroSpend: string
    landingHeroLocally: string

    // Landing page — drop-a-link section
    landingDropLinkHeading: string
    landingDropLinkBody: string

    // Landing page — CTAs
    landingSignUpNow: string

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
    exchangeSelectCurrency: string

    // Footer
    footerMadeWithLove: string
    footerLegalEntity: string
    footerSupport: string
    footerDocs: string
    footerTerms: string
    footerPrivacy: string
    footerSecurity: string
    footerStatus: string
    footerCareers: string
    footerTeaserLabel: string
    footerRickrollLabel: string
    footerFollowOnX: string
    footerViewGithub: string

    // Public status page (/status)
    statusPageTitle: string
    statusMetaTitle: string
    statusPageSubtitle: string
    statusAllOperational: string
    statusSomeDegraded: string
    statusSomeDown: string
    statusUnknown: string
    statusServicesOperational: string
    statusServicesOperationalCount: string
    statusWindowLabel: string
    statusUptimeLabel: string
    statusNow: string
    statusWindowStart: string
    statusIncidentOngoing: string
    statusIncidentResolved: string
    statusFeedUnreachable: string
    statusFeedUnreachableTitle: string
    statusBucketNotMonitored: string
    statusGroupApp: string
    statusServiceApp: string
    statusServiceSumsub: string
    statusServiceMantecaAr: string
    statusServiceMantecaBr: string
    statusServiceBridge: string
    statusServiceRhino: string
    statusServiceRpc: string
    statusServiceRain: string
    statusLegendOperational: string
    statusLegendDegraded: string
    statusLegendDown: string
    statusLegendNoData: string
    statusImpactApp: string
    statusImpactSumsub: string
    statusImpactMantecaAr: string
    statusImpactMantecaBr: string
    statusImpactBridge: string
    statusImpactRhino: string
    statusImpactRpc: string
    statusImpactRain: string
    statusImpactGeneric: string
    statusReasonTimeout: string
    statusReasonUnreachable: string
    statusReasonProviderError: string
    statusReasonProviderRejected: string
    statusReasonUnknown: string
    statusTimesInUtc: string

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
    footerFeatures: string
    footerExploreFeatures: string
    starLpUsEuAccounts: string
    starLpRequestLinks: string
    starLpSelfCustody: string
    starLpPeanutCard: string
    starLpQrArgentina: string
    starLpQrBrazil: string
    footerSiteDirectory: string
    footerCompare: string
    footerLearnMoreSection: string
    footerLegalSection: string
    footerCardTermsUs: string
    footerCardTermsInternational: string
    footerCardEsign: string
    footerCardPrivacy: string
    footerCardProhibitedActivities: string
    footerSendTo: string // "Send to {name}"
    footerSendFrom: string // "Send from {name}"
    footerPeanutVs: string // "Peanut vs {name}"
    // Learn More link labels, looked up by footer-manifest slug (SEOFooter)
    footerLinkPricing: string
    footerLinkSupportedNetworks: string
    footerLinkDigitalNomads: string
    footerLinkFamilies: string
    footerLinkRemoteWorkers: string
    footerLinkVerification: string

    // Misc
    lastUpdated: string // "Last updated: {date}"
    relatedPages: string // "Related Pages"

    // MDX <CompareSavings> on /compare/* — one whole sentence per render lane,
    // never fragments: word order differs between these four languages.
    compareSavingsLive: string // live rate: {base} {localBase} {competitor} {range} {worstCase} {localWorstCase} {date}
    compareSavingsStatic: string // no rate yet: {date} {competitor} {range} {worstCase} {base}
    compareSavingsUnverified: string // claim rejected — no fee number: {competitor} {date}
    compareSavingsSource: string // label on the link to the verified source
    calloutInfo: string // MDX <Callout type="info"> label
    calloutTip: string // MDX <Callout type="tip"> label
    calloutImportant: string // MDX <Callout type="warning"> label
    clearSearch: string // clear-button label on the marketing search fields

    // Content hub
    content: string // "Content" (nav label)
    contentHubTitle: string
    contentHubSubtitle: string
    contentSearchPlaceholder: string
    contentBrowseTopics: string
    contentCountryGuides: string
    contentTopicCountriesTitle: string
    contentTopicCountriesDescription: string
    contentTopicDepositTitle: string
    contentTopicDepositDescription: string
    contentTopicReceiveTitle: string
    contentTopicReceiveDescription: string
    contentTopicSendTitle: string
    contentTopicSendDescription: string
    contentTopicPayTitle: string
    contentTopicPayDescription: string
    contentTopicWithdrawTitle: string
    contentTopicWithdrawDescription: string
    inEnglish: string // label on a hub item the fallback serves in English ("En inglés")
    filterAll: string
    filterBlog: string
    filterStories: string
    filterUseCases: string
    filterCompare: string
    noContentResults: string
    backTo: string // "Back to {name}"
}
