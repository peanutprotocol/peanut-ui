'use client'

import { PageStack } from '@/components/0_Bruddle/PageStack'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import AddWithdrawCountriesList from '@/components/AddWithdraw/AddWithdrawCountriesList'
import dynamic from 'next/dynamic'

// stubs exist for web build; real components are injected by native build script.
const OnrampBankPage = dynamic(() => import('./_onramp-bank'), { ssr: false })
const OnrampMantecaPage = dynamic(() => import('./_onramp-manteca'), { ssr: false })
import { CountryList } from '@/components/Common/CountryList'
import type { CountryData } from '@/components/AddMoney/consts'
import NavHeader from '@/components/Global/NavHeader'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { getRedirectUrl, clearRedirectUrl, getFromLocalStorage } from '@/utils/general.utils'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { addMoneyCountryUrl, rewriteMethodPath } from '@/utils/native-routes'
import { useTranslations } from 'next-intl'

export default function AddMoneyPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const t = useTranslations('addMoney')
    const { resetOnrampFlow } = useOnrampFlow()

    // native app passes country as query param instead of path segment
    const countryFromQuery = searchParams.get('country')

    // clear stale onramp state on the root list (no country in the URL); reruns
    // on back-nav from a ?country=… sub-view, not just on mount. resetOnrampFlow
    // is a stable useCallback.
    useEffect(() => {
        if (!countryFromQuery) resetOnrampFlow()
    }, [countryFromQuery, resetOnrampFlow])

    const handleBack = () => {
        // if viewing country-specific form, go back to country list. Keep the
        // returnTo origin alive: dropping it here would strand the later backs
        // on /home instead of the caller (the bug returnTo exists to fix).
        if (countryFromQuery) {
            const params = new URLSearchParams()
            const origin = searchParams.get(RETURN_TO_PARAM)
            if (origin) params.set(RETURN_TO_PARAM, origin)
            router.push(params.size ? `/add-money?${params.toString()}` : '/add-money')
            return
        }

        // an explicit origin (e.g. the exchange-rate widget's "Try it!" CTA) wins over
        // the /home reset below — that reset is only right for tab-bar entries
        const returnTo = readReturnTo(searchParams, '/add-money')
        if (returnTo) {
            router.push(returnTo)
            return
        }

        // check if we have a saved redirect url (from request fulfillment or similar flows)
        const redirectUrl = getRedirectUrl()
        const fromRequestFulfillment = getFromLocalStorage('fromRequestFulfillment')

        if (redirectUrl && fromRequestFulfillment) {
            clearRedirectUrl()
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('fromRequestFulfillment')
            }
            router.push(redirectUrl)
            return
        }

        // always navigate to /home from root add-money page — router.back() causes
        // loops because sub-pages (crypto, country) are in the history stack
        router.push('/home')
    }

    const handleCountryClick = (country: CountryData) => {
        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
            method_type: 'bank',
            country: country.path,
        })

        // The user already chose "Bank" — skip the redundant per-country method
        // list and go straight to the deposit screen. AR/BR deposit via Manteca
        // (which surfaces Pix / Mercado Pago itself); every other bank-supported
        // country goes to the Bridge bank flow. Countries where bank isn't live
        // yet keep the per-country screen, which is still useful there: it shows
        // the "coming soon" bank state and the crypto fallback.
        if (isMantecaSupportedCountryCode(country.id)) {
            router.push(rewriteMethodPath(`/add-money/${country.path}/manteca`))
        } else if (isBridgeSupportedCountry(country.id)) {
            router.push(rewriteMethodPath(`/add-money/${country.path}/bank`))
        } else {
            router.push(addMoneyCountryUrl(country.path))
        }
    }

    // native app: render sub-views based on query params
    const viewFromQuery = searchParams.get('view')
    if (countryFromQuery && viewFromQuery === 'bank') {
        return <OnrampBankPage />
    }
    if (countryFromQuery && viewFromQuery === 'manteca') {
        return <OnrampMantecaPage />
    }
    if (countryFromQuery) {
        // country method selection: /add-money?country=austria
        return <AddWithdrawCountriesList flow="add" />
    }

    // The old "How would you like to add money?" interstitial is gone: the
    // root is one screen — the KYC-free crypto row FIRST (the activation
    // funnel rule in product/activation-funnel.md), then the bank country
    // list. Generic entries (checklists, CTAs, lifecycle emails) land here,
    // so crypto must stay reachable without the home Add drawer.
    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={handleBack} />
            <ListItem
                title={t('methods.crypto')}
                body={t('methods.cryptoDescription')}
                leading={<IconBubble icon="currency" size="s" color="blue" />}
                chevron
                position="single"
                onClick={() => router.push('/add-money/crypto')}
            />
            <CountryList
                inputTitle={t('selectYourCountry')}
                viewMode="add-withdraw"
                flow="add"
                onCountryClick={handleCountryClick}
            />
        </PageStack>
    )
}
