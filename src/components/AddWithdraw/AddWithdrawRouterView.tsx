'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { type DepositMethod, DepositMethodList } from '@/components/AddMoney/components/DepositMethodList'
import NavHeader from '@/components/Global/NavHeader'
import {
    type RecentMethod,
    getUserPreferences,
    updateUserPreferences,
    getFromLocalStorage,
} from '@/utils/general.utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { addMoneyCountryUrl, withdrawCountryUrl, rewriteMethodPath } from '@/utils/native-routes'
import { type FC, useEffect, useRef, useState, useTransition, useCallback } from 'react'
import { useUserStore } from '@/redux/hooks'
import { AccountType, type Account } from '@/interfaces/interfaces'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { isMantecaCountry } from '@/constants/manteca.consts'
import Card from '@/components/Global/Card'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { CountryList } from '../Common/CountryList'
import PeanutLoading from '../Global/PeanutLoading'
import SavedAccountsView from '../Common/SavedAccountsView'
import TokenAndNetworkConfirmationModal from '../Global/TokenAndNetworkConfirmationModal'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

interface AddWithdrawRouterViewProps {
    flow: 'add' | 'withdraw'
    pageTitle: string
    mainHeading: string
    onBackClick?: () => void
}

const MAX_RECENT_METHODS = 5

function saveRecentMethod(userId: string, method: DepositMethod, path?: string) {
    const newRecentMethod: RecentMethod = {
        id: method.id,
        type: method.type as 'crypto' | 'country',
        title: method.title,
        description: method.description,
        iconUrl: method.iconUrl,
        currency: method.currency,
        path: path ?? method.path,
    }

    const prefs = getUserPreferences(userId) || {}
    const currentRecentList = prefs.recentAddMethods || []

    const filteredList = currentRecentList.filter((m) => m.id !== newRecentMethod.id)

    const updatedRecentList = [newRecentMethod, ...filteredList].slice(0, MAX_RECENT_METHODS)

    updateUserPreferences(userId, { ...prefs, recentAddMethods: updatedRecentList })
}

export const AddWithdrawRouterView: FC<AddWithdrawRouterViewProps> = ({
    flow,
    pageTitle,
    mainHeading,
    onBackClick,
}) => {
    const router = useRouter()
    const { user } = useUserStore()
    const { setSelectedBankAccount, showAllWithdrawMethods, setShowAllWithdrawMethods, setSelectedMethod } =
        useWithdrawFlow()
    const onrampFlowContext = useOnrampFlow()
    const { setFromBankSelected } = onrampFlowContext
    const [recentMethodsState, setRecentMethodsState] = useState<RecentMethod[]>([])
    const [savedAccounts, setSavedAccounts] = useState<Account[]>([])
    // local flag only for add flow; for withdraw we derive from context
    const [localShowAllMethods, setLocalShowAllMethods] = useState<boolean>(false)
    const [isSupportedTokensModalOpen, setIsSupportedTokensModalOpen] = useState(false)
    const [, startTransition] = useTransition()
    const searchParams = useSearchParams()
    const currencyCode = searchParams.get('currencyCode')

    // check if coming from send flow
    const methodParam = searchParams.get('method')
    const isBankFromSend = methodParam === 'bank' && flow === 'withdraw'

    // determine if we should show the full list of methods (countries/crypto) instead of the default view
    let shouldShowAllMethods = flow === 'withdraw' ? showAllWithdrawMethods : localShowAllMethods
    const setShouldShowAllMethods = flow === 'withdraw' ? setShowAllWithdrawMethods : setLocalShowAllMethods
    const [isLoadingPreferences, setIsLoadingPreferences] = useState(true)

    // if currencyCode is present, show all methods
    if (currencyCode) {
        shouldShowAllMethods = true
    }

    // apply the default view (saved accounts vs all methods) only once per mount.
    // the user query re-dispatches a fresh `user` object on every refetch (window
    // focus, 4s pending-rail poll), and re-running the default unconditionally
    // yanked an open country list back to the saved-accounts view.
    const hasAppliedDefaultView = useRef(false)

    useEffect(() => {
        setIsLoadingPreferences(true)
        if (flow === 'withdraw') {
            const bankAccounts =
                user?.accounts.filter(
                    (acc) =>
                        acc.type === AccountType.IBAN ||
                        acc.type === AccountType.US ||
                        acc.type === AccountType.CLABE ||
                        acc.type === AccountType.GB ||
                        acc.type === AccountType.MANTECA
                ) ?? []

            if (bankAccounts.length > 0) {
                setSavedAccounts(bankAccounts as unknown as Account[])
                if (!hasAppliedDefaultView.current) setShouldShowAllMethods(false)
            } else {
                setSavedAccounts([])
            }
        } else {
            // 'add' flow logic
            const prefs = user ? getUserPreferences(user.user.userId) : undefined
            const currentRecentMethods = prefs?.recentAddMethods ?? []
            if (currentRecentMethods.length > 0) {
                setRecentMethodsState(currentRecentMethods)
                if (!hasAppliedDefaultView.current) setShouldShowAllMethods(false)
            } else if (!hasAppliedDefaultView.current) {
                setShouldShowAllMethods(true)
            }
        }
        // latch only once the user has loaded, so the first real resolution
        // (not the pre-auth null render) decides the default view
        if (user) hasAppliedDefaultView.current = true
        setIsLoadingPreferences(false)
    }, [flow, user, setShouldShowAllMethods])

    const handleMethodSelected = useCallback(
        (method: DepositMethod) => {
            if (flow === 'add' && user) {
                saveRecentMethod(user.user.userId, method)
                posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
                    method_type: method.type === 'crypto' ? 'crypto' : 'bank',
                    country: method.path?.split('?')[0].split('/').filter(Boolean).at(-1),
                })
            }

            // Handle "From Bank" specially for add flow
            if (flow === 'add' && method.id === 'bank-transfer-add') {
                setFromBankSelected(true)
                return
            }

            if (flow === 'add' && method.id === 'crypto') {
                setIsSupportedTokensModalOpen(true)
                return
            }

            // NEW: For withdraw flow, set selected method in context instead of navigating
            if (flow === 'withdraw') {
                const methodType =
                    method.type === 'crypto' ? 'crypto' : isMantecaCountry(method.path) ? 'manteca' : 'bridge'

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

                // Don't navigate - let the main withdraw page handle the flow
                return
            }

            if (method.path) {
                router.push(rewriteMethodPath(method.path))
            }
        },
        [flow, user]
    )

    const defaultBackNavigation = () => router.push('/home')

    // check if we're coming from request fulfillment or similar flow
    const fromRequestFulfillment = typeof window !== 'undefined' && getFromLocalStorage('fromRequestFulfillment')

    if (isLoadingPreferences) {
        return (
            <div className="flex min-h-[inherit] flex-col justify-center gap-8">
                <PeanutLoading />
            </div>
        )
    }

    if (flow === 'withdraw' && savedAccounts.length === 0 && !shouldShowAllMethods) {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start gap-8">
                <NavHeader title={pageTitle} onPrev={onBackClick || defaultBackNavigation} />
                <Card className="my-auto flex flex-col items-center justify-center gap-4 p-4">
                    <div className="space-y-2">
                        <AvatarWithBadge icon="alert" size="small" className="mx-auto bg-yellow-1" />
                        <div className="space-y-1 text-center">
                            <h2 className="text-lg font-bold">No accounts yet</h2>
                            <p className="text-sm text-grey-1">
                                Add your accounts details once
                                <br />
                                to withdraw in one tap.
                            </p>
                        </div>
                    </div>
                    <Button icon="plus" onClick={() => setShouldShowAllMethods(true)} shadowSize="4" className="w-full">
                        Add account
                    </Button>
                </Card>
            </div>
        )
    }

    // Render saved accounts for withdraw flow if they exist and we're not in 'showAll' mode
    if (flow === 'withdraw' && !shouldShowAllMethods && savedAccounts.length > 0) {
        return (
            <SavedAccountsView
                pageTitle={pageTitle}
                onPrev={onBackClick || defaultBackNavigation}
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
                        // preserve method param if coming from send flow
                        const additionalParams = isBankFromSend ? `&method=${methodParam}` : ''
                        router.push(
                            `/withdraw/manteca?country=${encodeURIComponent(countryPath)}&destination=${encodeURIComponent(account.identifier)}&isSavedAccount=true${additionalParams}`
                        )
                    }
                }}
                onSelectNewMethodClick={() => setShouldShowAllMethods(true)}
            />
        )
    }

    // Render recent methods for add flow
    if (flow === 'add' && !shouldShowAllMethods && recentMethodsState.length > 0) {
        // Transform recent methods to ensure proper type compatibility
        const recentMethodsWithType = recentMethodsState.map((method) => ({
            ...method,
            type: (method.type || 'country') as 'crypto' | 'country',
            path: method.path || '',
        }))

        return (
            <div className="flex min-h-[inherit] flex-col justify-normal gap-6">
                <NavHeader title={pageTitle} onPrev={onBackClick || defaultBackNavigation} />
                <div className="flex h-full flex-col justify-center space-y-2">
                    <h2 className="text-base font-bold">Recent methods</h2>
                    <DepositMethodList
                        methods={recentMethodsWithType as DepositMethod[]}
                        onItemClick={handleMethodSelected}
                        isAllMethodsView={false}
                    />
                </div>

                <div className="flex items-center gap-1">
                    <div className="h-[1px] w-full bg-grey-1"></div>
                    <span className="text-xs font-bold text-grey-1 lg:text-sm">or</span>
                    <div className="h-[1px] w-full bg-grey-1"></div>
                </div>
                <Button icon="plus" className="mb-5" onClick={() => setShouldShowAllMethods(true)} shadowSize="4">
                    Select new method
                </Button>
                <TokenAndNetworkConfirmationModal
                    onClose={() => {
                        setIsSupportedTokensModalOpen(false)
                    }}
                    onAccept={() => {
                        router.push('/add-money/crypto')
                    }}
                    isVisible={isSupportedTokensModalOpen}
                />
            </div>
        )
    }

    // show all methods view for both flows
    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader
                title={pageTitle}
                onPrev={() => {
                    // if coming from request fulfillment or similar external flow, go back immediately
                    if (fromRequestFulfillment) {
                        if (onBackClick) {
                            onBackClick()
                        } else {
                            defaultBackNavigation()
                        }
                        return
                    }

                    // otherwise, use toggle logic for better ux when user manually navigated to "select new method"
                    if (shouldShowAllMethods && (recentMethodsState.length > 0 || savedAccounts.length > 0)) {
                        setShouldShowAllMethods(false)
                    } else if (onBackClick) {
                        onBackClick()
                    } else {
                        defaultBackNavigation()
                    }
                }}
            />

            <CountryList
                inputTitle={mainHeading}
                viewMode="add-withdraw"
                enforceSupportedCountries={isBankFromSend}
                onCountryClick={(country) => {
                    if (flow === 'add') {
                        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
                            method_type: 'bank',
                            country: country.path,
                        })
                    } else {
                        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_METHOD_SELECTED, {
                            method_type: isMantecaCountry(country.path) ? 'manteca' : 'bridge',
                            country: country.path,
                        })
                    }

                    // from send flow (bank): set method in context and stay on /withdraw?method=bank
                    if (flow === 'withdraw' && isBankFromSend) {
                        if (isMantecaCountry(country.path)) {
                            const route = `/withdraw/manteca?method=bank-transfer&country=${country.path}`
                            startTransition(() => {
                                router.push(route)
                            })
                            return
                        }

                        // set selected method and let withdraw page move to amount input
                        setSelectedMethod({
                            type: 'bridge',
                            countryPath: country.path,
                            currency: country.currency,
                            title: country.title,
                        })
                        return
                    }

                    // default behaviour: navigate to country page
                    const queryParams = isBankFromSend ? `?method=${methodParam}` : ''
                    const countryUrl =
                        flow === 'withdraw'
                            ? withdrawCountryUrl(country.path, queryParams)
                            : addMoneyCountryUrl(country.path)
                    if (flow === 'add' && user) {
                        saveRecentMethod(user.user.userId, country, countryUrl)
                    }

                    // use transition for smoother navigation, keeps ui responsive during route change
                    startTransition(() => {
                        router.push(countryUrl)
                    })
                }}
                onCryptoClick={() => {
                    if (flow === 'add') {
                        posthog.capture(ANALYTICS_EVENTS.DEPOSIT_METHOD_SELECTED, {
                            method_type: 'crypto',
                            country: 'crypto',
                        })
                        setIsSupportedTokensModalOpen(true)
                    } else {
                        posthog.capture(ANALYTICS_EVENTS.WITHDRAW_METHOD_SELECTED, {
                            method_type: 'crypto',
                            country: 'crypto',
                        })
                        // set crypto method in context only — the withdraw page switches to the
                        // amount step and navigates to /withdraw/crypto after Continue. navigating
                        // here (pre-amount) trips the crypto page's "no amount" redirect guard,
                        // whose unmount cleanup resets the whole flow back to saved accounts.
                        setSelectedMethod({
                            type: 'crypto',
                            countryPath: 'crypto',
                            title: 'Crypto',
                        })
                    }
                }}
                flow={flow}
            />

            <TokenAndNetworkConfirmationModal
                onClose={() => {
                    setIsSupportedTokensModalOpen(false)
                }}
                onAccept={() => {
                    router.push('/add-money/crypto')
                }}
                isVisible={isSupportedTokensModalOpen}
            />
        </div>
    )
}
