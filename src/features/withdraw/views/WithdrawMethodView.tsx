'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { type DepositMethod } from '@/components/AddMoney/components/DepositMethodList'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'
import { CountryList } from '@/components/Common/CountryList'
import SavedAccountsView from '@/components/Common/SavedAccountsView'
import { useGeoFilteredPaymentOptions } from '@/hooks/useGeoFilteredPaymentOptions'
import { useSendFlowOrigin } from '@/hooks/useSendFlowOrigin'
import { useUserStore } from '@/redux/hooks'
import { AccountType, type Account } from '@/interfaces/interfaces'
import { isMantecaCountry } from '@/constants/manteca.consts'
import { getFromLocalStorage } from '@/utils/general.utils'
import { withdrawCountryUrl } from '@/utils/native-routes'
import { mantecaWithdrawUrl } from '@/features/withdraw/routes'
import { useWithdrawFlow } from '@/features/withdraw/WithdrawFlowContext'
import { useRouter } from 'next/navigation'
import { parseAsBoolean, parseAsString, useQueryState } from 'nuqs'
import { type FC, useMemo, useTransition } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useTranslations } from 'next-intl'

interface WithdrawMethodViewProps {
    pageTitle: string
    mainHeading: string
    /** Leave the flow (back on the first screen). */
    onExit: () => void
    /** A method was chosen and stored in the flow context — advance to the amount step. */
    onMethodChosen: () => void
}

/**
 * Method-select step of the withdraw flow. The "all methods vs saved accounts"
 * toggle lives in the URL (`?showAll=true`) — it used to be a context boolean
 * owned by two racing effects, which is the TASK-21198 list flicker.
 *
 * Withdraw-only: the former dual-flow AddWithdrawRouterView is gone (its
 * `add` branches had no consumer — add-money renders AddWithdrawCountriesList).
 */
export const WithdrawMethodView: FC<WithdrawMethodViewProps> = ({ pageTitle, mainHeading, onExit, onMethodChosen }) => {
    const router = useRouter()
    const { user } = useUserStore()
    const t = useTranslations('withdraw')
    const { setSelectedBankAccount, setSelectedMethod } = useWithdrawFlow()
    const [, startTransition] = useTransition()
    const [showAllParam, setShowAll] = useQueryState('showAll', parseAsBoolean.withDefault(false))

    const [methodParam] = useQueryState('method', parseAsString)
    const [currencyCode] = useQueryState('currencyCode', parseAsString)
    // if currencyCode is present, show all methods
    const showAll = showAllParam || !!currencyCode

    const isBankFromSend = useSendFlowOrigin().isBankFromSend
    // withdraw board 17832:80463: the Mercado Pago add-new-account row follows
    // the same geo gate as the send method list (hidden in brazil). gate on
    // !isLoading too — countryCode is null while geo resolves, and the filter
    // only removes mercadopago once it knows the user is in BR
    const { filteredMethods: geoMethods, isLoading: isGeoLoading } = useGeoFilteredPaymentOptions()
    const isMercadoPagoAvailable = !isGeoLoading && geoMethods.some((m) => m.id === 'mercadopago')

    const savedAccounts = useMemo<Account[]>(() => {
        const bankAccounts =
            user?.accounts.filter(
                (acc) =>
                    acc.type === AccountType.IBAN ||
                    acc.type === AccountType.US ||
                    acc.type === AccountType.CLABE ||
                    acc.type === AccountType.GB ||
                    acc.type === AccountType.MANTECA
            ) ?? []
        return bankAccounts as unknown as Account[]
    }, [user])

    // check if we're coming from request fulfillment or similar flow
    const fromRequestFulfillment = typeof window !== 'undefined' && getFromLocalStorage('fromRequestFulfillment')

    const handleMethodSelected = (method: DepositMethod) => {
        const methodType = method.type === 'crypto' ? 'crypto' : isMantecaCountry(method.path) ? 'manteca' : 'bridge'

        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_METHOD_SELECTED, {
            method_type: methodType,
            country: method.path?.split('?')[0].split('/').filter(Boolean).at(-1),
        })

        setSelectedMethod({
            type: methodType,
            countryPath: method.path,
            currency: method.currency,
            title: method.title,
        })
        onMethodChosen()
    }

    // The saved-accounts vs no-accounts split needs the user to have resolved —
    // rendering the empty-state card off a still-null user flashed the wrong
    // screen for signed-in users.
    if (!user) {
        return (
            <div className="flex min-h-[inherit] flex-col justify-center gap-8">
                <Loading variant="mascot" />
            </div>
        )
    }

    if (!showAll && savedAccounts.length === 0) {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start gap-8">
                <NavHeader title={pageTitle} onPrev={onExit} />
                <Card className="my-auto flex flex-col items-center justify-center gap-4 p-4">
                    <div className="space-y-2">
                        <IconBubble icon="alert" size="m" color="yellow" className="mx-auto" />
                        <div className="space-y-1 text-center">
                            <h2 className="text-heading-card text-foreground-primary">{t('noAccountsTitle')}</h2>
                            <p className="text-body-s text-foreground-secondary">
                                {t.rich('noAccountsDescription', { br: () => <br /> })}
                            </p>
                        </div>
                    </div>
                    <Button icon="plus" onClick={() => setShowAll(true)} shadowSize="4" className="w-full">
                        {t('addAccount')}
                    </Button>
                </Card>
            </div>
        )
    }

    if (!showAll && savedAccounts.length > 0) {
        return (
            <SavedAccountsView
                pageTitle={pageTitle}
                onPrev={onExit}
                savedAccounts={savedAccounts}
                onAccountClick={(account, path) => {
                    setSelectedBankAccount(account)
                    const countryPath = account.details?.countryName || path || ''
                    setSelectedMethod({
                        type: account.type === AccountType.MANTECA ? 'manteca' : 'bridge',
                        countryPath,
                        title: 'To Bank',
                    })
                    if (account.type === AccountType.MANTECA) {
                        // Manteca saved accounts skip the shared amount step — the
                        // manteca flow collects the amount in the local currency.
                        // preserve method param if coming from send flow
                        router.push(
                            mantecaWithdrawUrl({
                                country: countryPath,
                                destination: account.identifier,
                                isSavedAccount: 'true',
                                method: isBankFromSend ? (methodParam ?? undefined) : undefined,
                            })
                        )
                        return
                    }
                    onMethodChosen()
                }}
                onSelectNewMethodClick={() => setShowAll(true)}
                onCryptoClick={() =>
                    handleMethodSelected({ id: 'crypto', type: 'crypto', title: 'Crypto', path: 'crypto' })
                }
                onMercadoPagoClick={
                    isMercadoPagoAvailable
                        ? () => {
                              posthog.capture(ANALYTICS_EVENTS.WITHDRAW_METHOD_SELECTED, {
                                  method_type: 'manteca',
                                  country: 'argentina',
                              })
                              router.push(mantecaWithdrawUrl({ method: 'mercadopago', country: 'argentina' }))
                          }
                        : undefined
                }
            />
        )
    }

    // all-methods view
    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader
                title={pageTitle}
                onPrev={() => {
                    // if coming from request fulfillment or similar external flow, go back immediately
                    if (fromRequestFulfillment) {
                        onExit()
                        return
                    }
                    // toggle back to saved accounts when the user navigated to "select new method"
                    if (showAllParam && savedAccounts.length > 0) {
                        void setShowAll(null)
                    } else {
                        onExit()
                    }
                }}
            />

            <CountryList
                inputTitle={mainHeading}
                viewMode="add-withdraw"
                enforceSupportedCountries={isBankFromSend}
                onCountryClick={(country) => {
                    posthog.capture(ANALYTICS_EVENTS.WITHDRAW_METHOD_SELECTED, {
                        method_type: isMantecaCountry(country.path) ? 'manteca' : 'bridge',
                        country: country.path,
                    })

                    // from send flow (bank): set method in context and stay on /withdraw?method=bank
                    if (isBankFromSend) {
                        if (isMantecaCountry(country.path)) {
                            startTransition(() => {
                                router.push(mantecaWithdrawUrl({ method: 'bank-transfer', country: country.path }))
                            })
                            return
                        }
                        setSelectedMethod({
                            type: 'bridge',
                            countryPath: country.path,
                            currency: country.currency,
                            title: country.title,
                        })
                        onMethodChosen()
                        return
                    }

                    // default behaviour: navigate to country page
                    // use transition for smoother navigation, keeps ui responsive during route change
                    startTransition(() => {
                        router.push(withdrawCountryUrl(country.path))
                    })
                }}
                onCryptoClick={() =>
                    // set method in context, no navigation — the withdraw page owns
                    // the amount step and navigates to /withdraw/crypto after Continue
                    handleMethodSelected({ id: 'crypto', type: 'crypto', title: 'Crypto', path: 'crypto' })
                }
                flow="withdraw"
            />
        </div>
    )
}
