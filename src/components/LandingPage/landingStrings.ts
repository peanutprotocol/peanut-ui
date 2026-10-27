import { type Translations } from '@/i18n/types'
import type { HomeCardStrings } from './homeCard.types'
import type { HomeGetPaidStrings, HomePayLocalStrings, HomeRequestStrings, HomeSeamStrings } from './homeFolds.types'
import type { HomeHingeStrings } from './homeHinge.types'
import type { HomePersonaStrings } from './homePersona.types'

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
    /** The restored zero-transfer-fees fold (noFees). */
    zeroFees: string
    /** Screen-reader-only rest of the fees h2 ("transfer fees"). */
    zeroFeesSr: string
    reallyZero: string
    noHiddenFees: string
    seeMarkupOn: string
    sendMoney: string
    /** The wall of love's h2. */
    wallOfLove: string
    /** Marquee words for each seam a pink, sky or yellow fold touches. */
    seams: HomeSeamStrings
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

/** A catalog's seam words arrive as one string, "\n" between the words. */
const seamWords = (words: string): string[] => words.split('\n')

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
            heading: i18n.landingGetPaidHeading,
        },
        personas: {
            heading: i18n.landingPersonasHeading,
            designer: { who: i18n.landingPersonaDesignerWho, line: i18n.landingPersonaDesignerLine },
            developer: { who: i18n.landingPersonaDeveloperWho, line: i18n.landingPersonaDeveloperLine },
            editor: { who: i18n.landingPersonaEditorWho, line: i18n.landingPersonaEditorLine },
            writer: { who: i18n.landingPersonaWriterWho, line: i18n.landingPersonaWriterLine },
            photographer: { who: i18n.landingPersonaPhotographerWho, line: i18n.landingPersonaPhotographerLine },
        },
        request: {
            heading: i18n.landingRequestHeading,
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
            tagline: i18n.landingCardTagline,
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
        zeroFees: i18n.landingZeroFees,
        zeroFeesSr: i18n.landingZeroFeesSr,
        reallyZero: i18n.landingReallyZero,
        noHiddenFees: i18n.landingNoHiddenFees,
        seeMarkupOn: i18n.landingSeeMarkupOn,
        sendMoney: i18n.sendMoney,
        wallOfLove: i18n.landingWallOfLove,
        seams: {
            accounts: seamWords(i18n.landingSeamAccounts),
            personas: seamWords(i18n.landingSeamPersonas),
            link: seamWords(i18n.landingSeamLink),
            balance: seamWords(i18n.landingSeamBalance),
            card: seamWords(i18n.landingSeamCard),
            passkey: seamWords(i18n.landingSeamPasskey),
            accountFees: seamWords(i18n.landingSeamAccountFees),
            wallOfLove: seamWords(i18n.landingSeamWallOfLove),
            faq: seamWords(i18n.landingSeamFaq),
            close: seamWords(i18n.landingSeamClose),
            footer: seamWords(i18n.landingSeamFooter),
        },
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
