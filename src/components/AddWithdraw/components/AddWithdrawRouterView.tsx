'use client'
import { Button } from '@/components/0_Bruddle'
import { DepositMethod, DepositMethodList } from '@/components/AddMoney/components/DepositMethodList'
import { countryData as ALL_METHODS_DATA } from '@/components/AddMoney/consts' // Renamed for clarity
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { SearchInput } from '@/components/SearchUsers/SearchInput'
import { RecentMethod, getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { useRouter } from 'next/navigation'
import { FC, useEffect, useMemo, useState } from 'react'

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
    const [recentMethodsState, setRecentMethodsState] = useState<RecentMethod[]>([])
    const [showAllMethods, setShowAllMethods] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [isLoadingPreferences, setIsLoadingPreferences] = useState(true)

    const baseRoute = flow === 'add' ? '/add-money' : '/withdraw'

    useEffect(() => {
        const prefs = getUserPreferences()
        const currentRecentMethods = flow === 'add' ? prefs?.recentAddMethods : prefs?.recentWithdrawMethods
        if (currentRecentMethods && currentRecentMethods.length > 0) {
            setRecentMethodsState(currentRecentMethods)
            setShowAllMethods(false)
        } else {
            setShowAllMethods(true)
        }
        setIsLoadingPreferences(false)
    }, [flow])

    const handleMethodSelected = (method: DepositMethod) => {
        const newRecentMethod: RecentMethod = {
            id: method.id,
            type: method.type,
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
            updateUserPreferences({ ...prefs, recentWithdrawMethods: updatedRecentList })
        }

        router.push(method.path)
    }

    const allMethodsTransformed: DepositMethod[] = useMemo(() => {
        return ALL_METHODS_DATA.map((method) => {
            let path = `${baseRoute}/${method.path}`
            return {
                ...method,
                path: path,
            }
        })
    }, [baseRoute])

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

    if (!showAllMethods && recentMethodsState.length > 0) {
        return (
            <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
                <NavHeader title={pageTitle} onPrev={onBackClick || defaultBackNavigation} />
                <div className="flex h-full flex-col justify-center space-y-2">
                    <h2 className="text-base font-bold">Recent methods</h2>
                    <DepositMethodList
                        methods={recentMethodsState}
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

    // show all methods view
    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader
                title={pageTitle}
                onPrev={() => {
                    if (recentMethodsState.length > 0 && showAllMethods) {
                        // if in 'all methods' view and there were recent methods, go back to 'recent methods' view.
                        setShowAllMethods(false)
                    } else if (onBackClick) {
                        // if onBackClick is provided (e.g., to go to previous step like amount input)
                        onBackClick()
                    } else {
                        // fallback for flows where onBackClick might not be set (e.g., initial 'add money' view with no recent)
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
