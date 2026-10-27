import { type Translations } from '@/i18n/types'
import type { HomeCardStrings } from './homeCard.types'
import type { HomeGetPaidStrings, HomePayLocalStrings, HomeRequestStrings } from './homeFolds.types'
import type { HomeHingeStrings } from './homeHinge.types'
import type { HomePersonaStrings } from './landing.types'

// Narrowed copy bag handed from the server landing page down through
// LandingPageClient. Keeps the client bundle from importing all locale
// catalogs (same reason ContentLanding/HelpLanding take `strings`).
export interface LandingStrings {
    signUp: string
    logIn: string
    signUpNow: string
    heroHeadline: string
    heroSubline: string
    heroGetPaid: string
    heroGlobally: string
    heroSpend: string
    heroLocally: string
    learnMore: string
    dropLinkHeading: string
    dropLinkBody: string
    getPaid: HomeGetPaidStrings
    personas: HomePersonaStrings
    request: HomeRequestStrings
    hinge: HomeHingeStrings
    card: HomeCardStrings
    payLocal: HomePayLocalStrings
    /** First word of the ticker under the card fold; "Mercado Pago" and "Pix" follow it. */
    seamCard: string
    /** First words of the ticker over the trust band; "USD" and "EUR" follow them. */
    seamPasskey: string
    /** The black trust band. "\n" marks the line break from xs. */
    trustLine: string
    faqFootnote: string
    /** The closing Knerd title. "\n" between its lines. */
    closeTitle: string
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
        selectCurrency: string
    }
}

export function landingStrings(i18n: Translations): LandingStrings {
    return {
        signUp: i18n.landingSignUp,
        logIn: i18n.landingLogIn,
        signUpNow: i18n.landingSignUpNow,
        heroHeadline: i18n.landingHeroHeadline,
        heroSubline: i18n.landingHeroSubline,
        heroGetPaid: i18n.landingHeroGetPaid,
        heroGlobally: i18n.landingHeroGlobally,
        heroSpend: i18n.landingHeroSpend,
        heroLocally: i18n.landingHeroLocally,
        learnMore: i18n.landingLearnMore,
        dropLinkHeading: i18n.landingDropLinkHeading,
        dropLinkBody: i18n.landingDropLinkBody,
        getPaid: {
            lead: i18n.landingGetPaidLead,
            knerd: i18n.landingGetPaidKnerd,
        },
        personas: {
            heading: i18n.landingPersonasHeading,
            designerWho: i18n.landingPersonaDesignerWho,
            designerLine: i18n.landingPersonaDesignerLine,
            developerWho: i18n.landingPersonaDeveloperWho,
            developerLine: i18n.landingPersonaDeveloperLine,
        },
        request: {
            question: i18n.landingRequestQuestion,
            action: i18n.landingRequestAction,
            requesting: i18n.landingRequestRequesting,
            paid: i18n.landingRequestPaid,
            chatLabel: i18n.landingRequestChatLabel,
        },
        hinge: {
            heading: i18n.landingHingeHeading,
            balance: i18n.landingHingeBalance,
            activity: i18n.landingHingeActivity,
            moneyIn: i18n.landingHingeMoneyIn,
            screenLabel: i18n.landingHingeScreenLabel,
        },
        card: {
            lockup: i18n.landingCardLockup,
            knerd: i18n.landingCardKnerd,
            line: i18n.landingCardLine,
            cta: i18n.landingCardGetYourCard,
            receiptTitle: i18n.landingCardReceiptTitle,
            receiptApproved: i18n.landingCardReceiptApproved,
        },
        payLocal: {
            heading: i18n.landingPayLocalHeading,
            lead: i18n.landingPayLocalLead,
            argentina: i18n.landingPayLocalArgentina,
            brazil: i18n.landingPayLocalBrazil,
        },
        seamCard: i18n.landingSeamCard,
        seamPasskey: i18n.landingSeamPasskey,
        trustLine: i18n.landingTrustLine,
        faqFootnote: i18n.landingFaqFootnote,
        closeTitle: i18n.landingCloseTitle,
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
            selectCurrency: i18n.exchangeSelectCurrency,
        },
    }
}
