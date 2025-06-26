'use client'
import { Button } from '@/components/0_Bruddle'
import { DepositMethod, DepositMethodList } from '@/components/AddMoney/components/DepositMethodList'
import {
    countryData as ALL_METHODS_DATA,
    countryCodeMap,
    UPDATED_DEFAULT_ADD_MONEY_METHODS,
} from '@/components/AddMoney/consts'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { SearchInput } from '@/components/SearchUsers/SearchInput'
import { RecentMethod, getUserPreferences, updateUserPreferences, shortenAddressLong } from '@/utils/general.utils'
import { useRouter } from 'next/navigation'
import { FC, useEffect, useMemo, useState } from 'react'
import { useUserStore } from '@/redux/hooks'
import { AccountType, Account } from '@/interfaces'
import Image from 'next/image'
import { Icon } from '@/components/Global/Icons/Icon'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import Divider from '@/components/0_Bruddle/Divider'
import Card from '@/components/Global/Card'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'

interface AddWithdrawRouterViewProps {
    flow: 'add' | 'withdraw'
    pageTitle: string
    mainHeading: string
    onBackClick?: () => void
}

const MAX_RECENT_METHODS = 5

export const AddWithdrawRouterView: FC<AddWithdrawRouterViewProps> = ({
    flow,
    pageTitle,
    mainHeading,
    onBackClick,
}) => {
    const router = useRouter()
    const { user } = useUserStore()
    const { setSelectedBankAccount } = useWithdrawFlow()
    const onrampFlowContext = useOnrampFlow()
    const { setFromBankSelected } = onrampFlowContext
    const [recentMethodsState, setRecentMethodsState] = useState<RecentMethod[]>([])
    const [savedAccounts, setSavedAccounts] = useState<Account[]>([])
    const [showAllMethods, setShowAllMethods] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [isLoadingPreferences, setIsLoadingPreferences] = useState(true)

    const baseRoute = flow === 'add' ? '/add-money' : '/withdraw'

    useEffect(() => {
        setIsLoadingPreferences(true)
        if (flow === 'withdraw') {
            const bankAccounts =
                user?.accounts.filter((acc) => acc.type === AccountType.IBAN || acc.type === AccountType.US) ?? []

            if (bankAccounts.length > 0) {
                setSavedAccounts(bankAccounts as unknown as Account[])
                setShowAllMethods(false)
            } else {
                setSavedAccounts([])
                setShowAllMethods(false)
            }
        } else {
            // 'add' flow logic
            const prefs = getUserPreferences()
            const currentRecentMethods = prefs?.recentAddMethods ?? []
            if (currentRecentMethods.length > 0) {
                setRecentMethodsState(currentRecentMethods)
                setShowAllMethods(false)
            } else {
                setShowAllMethods(true)
            }
        }
        setIsLoadingPreferences(false)
    }, [flow, user])

    const handleMethodSelected = (method: DepositMethod) => {
        // Handle "From Bank" specially for add flow
        if (flow === 'add' && method.id === 'bank-transfer-add') {
            setFromBankSelected(true)
            return
        }

        const newRecentMethod: RecentMethod = {
            id: method.id,
            type: method.type as 'crypto' | 'country',
            title: method.title,
            description: method.description,
            iconUrl: method.iconUrl,
            currency: method.currency,
            path: method.path,
        }

        const prefs = getUserPreferences() || {}
        let currentRecentList: RecentMethod[] = []
        if (flow === 'add') {
            currentRecentList = prefs.recentAddMethods || []
        } else {
            currentRecentList = prefs.recentWithdrawMethods || []
        }

        const filteredList = currentRecentList.filter(
            (m) => !(m.id === newRecentMethod.id && m.type === newRecentMethod.type)
        )

        const updatedRecentList = [newRecentMethod, ...filteredList].slice(0, MAX_RECENT_METHODS)

        if (flow === 'add') {
            updateUserPreferences({ ...prefs, recentAddMethods: updatedRecentList })
        } else {
            // for withdraw, we don't save to recents from the 'all methods' list, we show saved accounts
        }

        if (method.path) {
            router.push(method.path)
        }
    }

    const allMethodsTransformed: DepositMethod[] = useMemo(() => {
        let methods = ALL_METHODS_DATA.map((method) => {
            let path = `${baseRoute}/${method.path}`
            return {
                ...method,
                path: path,
                type: method.type as 'crypto' | 'country',
            }
        })

        // Add special methods for add flow
        if (flow === 'add') {
            const addMethods = UPDATED_DEFAULT_ADD_MONEY_METHODS.map((method) => ({
                id: method.id,
                title: method.title,
                description: method.description,
                iconUrl: typeof method.icon === 'string' ? method.icon : undefined,
                type: 'country' as 'crypto' | 'country',
                path: '', // No path needed for From Bank, handled specially
            }))
            methods = [...addMethods, ...methods]
        }

        return methods
    }, [baseRoute, flow])

    const filteredAllMethods = useMemo(() => {
        let methodsToShow
        if (!searchTerm) {
            methodsToShow = [...allMethodsTransformed]
        } else {
            methodsToShow = allMethodsTransformed.filter(
                (method) =>
                    method.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    method.currency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    method.description?.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        const transformedMethods = methodsToShow.map((method) => {
            if (method.type === 'crypto') {
                return {
                    ...method,
                    title: flow === 'add' ? 'Crypto Deposit' : 'Crypto',
                    description: flow === 'add' ? 'Use an exchange or your wallet' : 'Withdraw to a wallet or exchange',
                }
            }
            return method
        })

        return transformedMethods.sort((a, b) => {
            if (a.type === 'crypto' && b.type !== 'crypto') {
                return -1
            }
            if (b.type === 'crypto' && a.type !== 'crypto') {
                return 1
            }
            return a.title.toLowerCase().localeCompare(b.title.toLowerCase())
        })
    }, [searchTerm, allMethodsTransformed, flow])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value)
    }

    const handleClearSearch = () => {
        setSearchTerm('')
    }

    const defaultBackNavigation = () => router.push('/home')

    if (isLoadingPreferences) {
        return null
    }

    if (flow === 'withdraw' && savedAccounts.length === 0 && !showAllMethods) {
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
                    <Button icon="plus" onClick={() => setShowAllMethods(true)} shadowSize="4" className="w-full">
                        Add account
                    </Button>
                </Card>
            </div>
        )
    }

    // Render saved accounts for withdraw flow if they exist and we're not in 'showAll' mode
    if (flow === 'withdraw' && !showAllMethods && savedAccounts.length > 0) {
        return (
            <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
                <NavHeader title={pageTitle} onPrev={onBackClick || defaultBackNavigation} />
                <div className="space-y-4">
                    <div className="flex h-full flex-col justify-center space-y-2">
                        <h2 className="text-base font-bold">Saved accounts</h2>
                        <SavedAccountsList
                            accounts={savedAccounts}
                            onItemClick={(account, path) => {
                                setSelectedBankAccount(account)
                                router.push(path)
                            }}
                        />
                    </div>
                    <Divider textClassname="font-bold text-grey-1" dividerClassname="bg-grey-1" text="or" />
                    <Button icon="plus" onClick={() => setShowAllMethods(true)} shadowSize="4">
                        Select new method
                    </Button>
                </div>
            </div>
        )
    }

    // Render recent methods for add flow
    if (flow === 'add' && !showAllMethods && recentMethodsState.length > 0) {
        // Transform recent methods to ensure proper type compatibility
        const recentMethodsWithType = recentMethodsState.map((method) => ({
            ...method,
            type: (method.type || 'country') as 'crypto' | 'country',
            path: method.path || '',
        }))

        return (
            <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
                <NavHeader title={pageTitle} onPrev={onBackClick || defaultBackNavigation} />
                <div className="flex h-full flex-col justify-center space-y-2">
                    <h2 className="text-base font-bold">Recent methods</h2>
                    <DepositMethodList
                        methods={recentMethodsWithType as DepositMethod[]}
                        onItemClick={handleMethodSelected}
                        isAllMethodsView={false}
                    />
                </div>
                <Button icon="plus" className="mb-5 mt-auto" onClick={() => setShowAllMethods(true)} shadowSize="4">
                    Select new method
                </Button>
            </div>
        )
    }

    // show all methods view for both flows
    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader
                title={pageTitle}
                onPrev={() => {
                    const hasRecentOrSaved = flow === 'add' ? recentMethodsState.length > 0 : savedAccounts.length > 0
                    if (hasRecentOrSaved && showAllMethods) {
                        setShowAllMethods(false)
                    } else if (onBackClick) {
                        onBackClick()
                    } else {
                        defaultBackNavigation()
                    }
                }}
            />

            <div className="flex h-full w-full flex-1 flex-col justify-start space-y-2">
                <h2 className="text-base font-bold">{mainHeading}</h2>

                <SearchInput
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onClear={handleClearSearch}
                    placeholder="Search country or currency"
                />
                {searchTerm && filteredAllMethods.length === 0 ? (
                    <EmptyState
                        title="No results found"
                        description="Try searching with a different term."
                        icon="search"
                    />
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        <DepositMethodList
                            methods={filteredAllMethods}
                            onItemClick={handleMethodSelected}
                            isAllMethodsView={true}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

// component to render saved bank accounts
const SavedAccountsList: FC<{ accounts: Account[]; onItemClick: (account: Account, path: string) => void }> = ({
    accounts,
    onItemClick,
}) => {
    return (
        <div className="flex flex-col">
            {accounts.map((account, index) => {
                let details: { countryCode?: string; countryName?: string; country?: string } = {}
                if (typeof account.details === 'string') {
                    try {
                        details = JSON.parse(account.details)
                    } catch (error) {
                        console.error('Failed to parse account_details:', error)
                    }
                } else if (typeof account.details === 'object' && account.details !== null) {
                    details = account.details as { country?: string }
                }

                const threeLetterCountryCode = (details.countryCode ?? '').toUpperCase()
                const twoLetterCountryCode = countryCodeMap[threeLetterCountryCode] ?? threeLetterCountryCode

                const countryCodeForFlag = twoLetterCountryCode.toLowerCase() ?? ''

                let countryInfo
                if (account.type === AccountType.US) {
                    countryInfo = ALL_METHODS_DATA.find((c) => c.id === 'US')
                } else {
                    countryInfo = details.countryName
                        ? ALL_METHODS_DATA.find((c) => c.title.toLowerCase() === details.countryName?.toLowerCase())
                        : ALL_METHODS_DATA.find((c) => c.id === threeLetterCountryCode)
                }

                const path = countryInfo ? `/withdraw/${countryInfo.path}/bank` : '/withdraw'
                const isSingle = accounts.length === 1
                const isFirst = index === 0
                const isLast = index === accounts.length - 1

                let position: 'first' | 'last' | 'middle' | 'single' = 'middle'
                if (isSingle) position = 'single'
                else if (isFirst) position = 'first'
                else if (isLast) position = 'last'

                return (
                    <SearchResultCard
                        key={account.id}
                        title={shortenAddressLong(account.identifier.toUpperCase(), 6)}
                        position={position}
                        onClick={() => onItemClick(account, path)}
                        className="p-4 py-2.5"
                        leftIcon={
                            <div className="relative h-8 w-8">
                                {countryCodeForFlag && (
                                    <Image
                                        src={`https://flagcdn.com/w160/${account.type === AccountType.US ? 'us' : countryCodeForFlag}.png`}
                                        alt={`${details.countryName ?? 'country'} flag`}
                                        width={80}
                                        height={80}
                                        className="h-8 w-8 rounded-full object-cover"
                                    />
                                )}
                                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 p-1">
                                    <Icon name="bank" className="h-full w-full text-black" />
                                </div>
                            </div>
                        }
                    />
                )
            })}
        </div>
    )
}
