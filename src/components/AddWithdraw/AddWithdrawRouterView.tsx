'use client'
import { Button } from '@/components/0_Bruddle'
import { DepositMethod, DepositMethodList } from '@/components/AddMoney/components/DepositMethodList'
import NavHeader from '@/components/Global/NavHeader'
import { RecentMethod, getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { useRouter } from 'next/navigation'
import { FC, useEffect, useState, useCallback } from 'react'
import { useUserStore } from '@/redux/hooks'
import { AccountType, Account } from '@/interfaces'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { isMantecaCountry } from '@/constants/manteca.consts'
import Card from '@/components/Global/Card'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { CountryList } from '../Common/CountryList'
import PeanutLoading from '../Global/PeanutLoading'
import SavedAccountsView from '../Common/SavedAccountsView'
import CryptoMethodDrawer from '../AddMoney/components/CryptoMethodDrawer'

interface AddWithdrawRouterViewProps {
    flow: 'add' | 'withdraw'
    pageTitle: string
    mainHeading: string
    onBackClick?: () => void
}

const MAX_RECENT_METHODS = 5

function saveRecentMethod(userId: string, method: DepositMethod) {
    const newRecentMethod: RecentMethod = {
        id: method.id,
        type: method.type as 'crypto' | 'country',
        title: method.title,
        description: method.description,
        iconUrl: method.iconUrl,
        currency: method.currency,
        path: `/add-money/${method.path}`,
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
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    // determine if we should show the full list of methods (countries/crypto) instead of the default view
    const shouldShowAllMethods = flow === 'withdraw' ? showAllWithdrawMethods : localShowAllMethods
    const setShouldShowAllMethods = flow === 'withdraw' ? setShowAllWithdrawMethods : setLocalShowAllMethods
    const [isLoadingPreferences, setIsLoadingPreferences] = useState(true)

    const baseRoute = flow === 'add' ? '/add-money' : '/withdraw'

    useEffect(() => {
        setIsLoadingPreferences(true)
        if (flow === 'withdraw') {
            const bankAccounts =
                user?.accounts.filter(
                    (acc) =>
                        acc.type === AccountType.IBAN ||
                        acc.type === AccountType.US ||
                        acc.type === AccountType.CLABE ||
                        acc.type === AccountType.MANTECA
                ) ?? []

            if (bankAccounts.length > 0) {
                setSavedAccounts(bankAccounts as unknown as Account[])
                setShouldShowAllMethods(false)
            } else {
                setSavedAccounts([])
            }
        } else {
            // 'add' flow logic
            const prefs = user ? getUserPreferences(user.user.userId) : undefined
            const currentRecentMethods = prefs?.recentAddMethods ?? []
            if (currentRecentMethods.length > 0) {
                setRecentMethodsState(currentRecentMethods)
                setShouldShowAllMethods(false)
            } else {
                setShouldShowAllMethods(true)
            }
        }
        setIsLoadingPreferences(false)
    }, [flow, user, setShouldShowAllMethods])

    const handleMethodSelected = useCallback(
        (method: DepositMethod) => {
            if (flow === 'add' && user) {
                saveRecentMethod(user.user.userId, method)
            }

            // Handle "From Bank" specially for add flow
            if (flow === 'add' && method.id === 'bank-transfer-add') {
                setFromBankSelected(true)
                return
            }

            if (flow === 'add' && method.id === 'crypto') {
                setIsDrawerOpen(true)
                return
            }

            // NEW: For withdraw flow, set selected method in context instead of navigating
            if (flow === 'withdraw') {
                const methodType =
                    method.type === 'crypto' ? 'crypto' : isMantecaCountry(method.path) ? 'manteca' : 'bridge'

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
                router.push(method.path)
            }
        },
        [flow, user]
    )

    const defaultBackNavigation = () => router.push('/home')

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

                    // FIXED: For withdraw flow, route to saved account path
                    if (flow === 'withdraw') {
                        if (account.type === AccountType.MANTECA) {
                            router.push(
                                `/withdraw/manteca?country=${account.details.countryName}&destination=${account.identifier}`
                            )
                        } else {
                            router.push(path)
                        }
                        return
                    }

                    // Original add flow
                    router.push(path)
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
                <CryptoMethodDrawer
                    isDrawerOpen={isDrawerOpen}
                    setisDrawerOpen={setIsDrawerOpen}
                    closeDrawer={() => setIsDrawerOpen(false)}
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
                    if (shouldShowAllMethods) {
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
                onCountryClick={(country) => {
                    if (flow === 'withdraw') {
                        const countryPath = `${baseRoute}/${country.path}`
                        router.push(countryPath)
                        return
                    }

                    //Add
                    if (user) {
                        saveRecentMethod(user.user.userId, country)
                    }
                    const countryPath = `${baseRoute}/${country.path}`
                    router.push(countryPath)
                }}
                onCryptoClick={() => {
                    if (flow === 'add') {
                        setIsDrawerOpen(true)
                    } else {
                        // Set crypto method and navigate to main page for amount input
                        setSelectedMethod({
                            type: 'crypto',
                            countryPath: 'crypto',
                            title: 'Crypto',
                        })
                        router.push('/withdraw')
                    }
                }}
                flow={flow}
            />
            <CryptoMethodDrawer
                isDrawerOpen={isDrawerOpen}
                setisDrawerOpen={setIsDrawerOpen}
                closeDrawer={() => setIsDrawerOpen(false)}
            />
        </div>
    )
}
