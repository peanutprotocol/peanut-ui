import en from '@/i18n/en.json'
import { type Translations } from '@/i18n/types'
import type { LandingProblemStrings } from './landing.types'

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
    problem: LandingProblemStrings
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
        problem: {
            heading: i18n.landingProblemHeading,
            crossBorderTitle: i18n.landingProblemCrossBorderTitle,
            crossBorderBody: i18n.landingProblemCrossBorderBody,
            sendHomeTitle: i18n.landingProblemSendHomeTitle,
            sendHomeBody: i18n.landingProblemSendHomeBody,
            paidAbroadTitle: i18n.landingProblemPaidAbroadTitle,
            paidAbroadBody: i18n.landingProblemPaidAbroadBody,
        },
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
