import en from '@/i18n/en.json'
import { type Translations } from '@/i18n/types'
import type {
    LandingCardBeatStrings,
    LandingManifestoStrings,
    LandingNotForYouStrings,
    LandingProblemStrings,
    LandingWorksTodayStrings,
} from './landing.types'

// Narrowed copy bag handed from the server landing page down through
// LandingPageClient. Keeps the client bundle from importing all locale
// catalogs (same reason ContentLanding/HelpLanding take `strings`).
export interface LandingStrings {
    signUp: string
    signUpNow: string
    sendNow: string
    sendMoney: string
    heroTapScan: string
    heroNoLocalId: string
    zeroFees: string
    seeMarkupOn: string
    dropLinkHeading: string
    dropLinkBody: string
    currencyPlaceholder: string
    cardHeading: string
    cardBody: string
    cardBullet1: string
    cardBullet2: string
    cardBullet3: string
    cardDisclaimer: string
    cardCta: string
    wallOfLove: string
    wallOfLoveBody: string
    /** Door CTA shared by CardBeat, NotForYou and StickyMobileCTA. */
    tryTheDoor: string
    cardBeat: LandingCardBeatStrings
    manifesto: LandingManifestoStrings
    problem: LandingProblemStrings
    worksToday: LandingWorksTodayStrings
    notForYou: LandingNotForYouStrings
    /** Words of the closed-beta marquee strip, in order. */
    marqueeClosedBeta: string[]
    /** Passed straight through to ExchangeRateWidget's `labels`. */
    exchange: {
        youSend: string
        recipientGets: string
        swapCurrencies: string
        rateUnavailable: string
        bankFee: string
        peanutFee: string
        free: string
        arrivesHours: string
        arrivesMinutes: string
    }
}

export function landingStrings(i18n: Translations): LandingStrings {
    return {
        signUp: i18n.landingSignUp,
        signUpNow: i18n.landingSignUpNow,
        sendNow: i18n.landingSendNow,
        sendMoney: i18n.sendMoney,
        heroTapScan: i18n.landingHeroTapScan,
        heroNoLocalId: i18n.landingHeroNoLocalId,
        zeroFees: i18n.landingZeroFees,
        seeMarkupOn: i18n.landingSeeMarkupOn,
        dropLinkHeading: i18n.landingDropLinkHeading,
        dropLinkBody: i18n.landingDropLinkBody,
        currencyPlaceholder: i18n.landingCurrencyPlaceholder,
        cardHeading: i18n.landingCardHeading,
        cardBody: i18n.landingCardBody,
        cardBullet1: i18n.landingCardBullet1,
        cardBullet2: i18n.landingCardBullet2,
        cardBullet3: i18n.landingCardBullet3,
        cardDisclaimer: i18n.landingCardDisclaimer,
        cardCta: i18n.landingCardCta,
        wallOfLove: i18n.landingWallOfLove,
        wallOfLoveBody: i18n.landingWallOfLoveBody,
        tryTheDoor: i18n.landingTryTheDoor,
        cardBeat: {
            // The catalogs keep every value trimmed (i18n/__tests__/messages.test.ts)
            // and JSX drops the newline between two expressions, so the spaces
            // around the inline /setup link are added here. The counter chip
            // carries its own margin, so the body halves need none.
            bridgeBefore: `${i18n.landingCardBeatBridgeBefore} `,
            bridgeLinkLabel: i18n.landingCardBeatBridgeLink,
            bridgeAfter: ` ${i18n.landingCardBeatBridgeAfter}`,
            kicker: i18n.landingCardBeatKicker,
            heading: i18n.landingCardBeatHeading,
            tagline: i18n.landingCardBeatTagline,
            bodyBefore: i18n.landingCardBeatBodyBefore,
            counterLabel: i18n.landingCardBeatCounterLabel,
            bodyAfter: i18n.landingCardBeatBodyAfter,
            custody: i18n.landingCardBeatCustody,
            trust: i18n.landingCardBeatTrust,
            waitlistLink: i18n.landingCardBeatWaitlistLink,
            statMerchants: i18n.landingCardBeatStatMerchants,
            statBalance: i18n.landingCardBeatStatBalance,
            statCard: i18n.landingCardBeatStatCard,
            statMonthlyFees: i18n.landingCardBeatStatMonthlyFees,
        },
        manifesto: {
            heading: i18n.landingManifestoHeading,
            subline: i18n.landingManifestoSubline,
        },
        problem: {
            heading: i18n.landingProblemHeading,
            prose: i18n.landingProblemProse,
            pointerPassport: i18n.landingProblemPointerPassport,
            pointerRate: i18n.landingProblemPointerRate,
            pointerMoneyOut: i18n.landingProblemPointerMoneyOut,
        },
        worksToday: {
            heading: i18n.landingWorksTodayHeading,
            subline: i18n.landingWorksTodaySubline,
            payLocalTitle: i18n.landingWorksTodayPayLocalTitle,
            payLocalBody: i18n.landingPayLocalBody,
            payLocalNote: i18n.landingPayLocalSettles,
            payLocalMoneyOut: i18n.landingWorksTodayMoneyOut,
            payLocalChipEurPix: i18n.landingWorksTodayChipEurPix,
            payLocalChipUsdMercadoPago: i18n.landingWorksTodayChipUsdMercadoPago,
            dropLinkTitle: i18n.landingWorksTodayDropLinkTitle,
            rateTitle: i18n.landingWorksTodayRateTitle,
            securityTitle: i18n.landingWorksTodaySecurityTitle,
            securityBody: i18n.landingWorksTodaySecurityBody,
        },
        notForYou: {
            heading: i18n.landingNotForYouHeading,
            body: i18n.landingNotForYouBody,
            signUpLink: i18n.landingNotForYouSignUpLink,
        },
        marqueeClosedBeta: [i18n.landingMarqueeClosedBeta, i18n.landingMarqueeShhhh, i18n.landingMarqueeWordTravels],
        exchange: {
            youSend: i18n.exchangeYouSend,
            recipientGets: i18n.exchangeRecipientGets,
            swapCurrencies: i18n.exchangeSwapCurrencies,
            rateUnavailable: i18n.exchangeRateUnavailable,
            bankFee: i18n.exchangeBankFee,
            peanutFee: i18n.exchangePeanutFee,
            free: i18n.exchangeFree,
            arrivesHours: i18n.exchangeArrivesHours,
            arrivesMinutes: i18n.exchangeArrivesMinutes,
        },
    }
}

// For the English-only pages that reuse landing sections (/exchange, /quests).
// Imports just en.json so those client bundles don't pull every locale catalog.
export const EN_LANDING_STRINGS = landingStrings(en as Translations)
