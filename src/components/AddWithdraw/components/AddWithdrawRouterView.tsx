'use client'
import { Button } from '@/components/0_Bruddle'
import { DepositMethod, DepositMethodList } from '@/components/AddMoney/components/DepositMethodList'
import { countryData as ALL_METHODS_DATA } from '@/components/AddMoney/consts' // Renamed for clarity
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { SearchInput } from '@/components/SearchUsers/SearchInput'
import { useRouter } from 'next/navigation'
import { FC, useMemo, useState } from 'react'

interface AddWithdrawRouterViewProps {
    flow: 'add' | 'withdraw'
    pageTitle: string
    mainHeading: string
    onBackClick?: () => void
    recentMethods: DepositMethod[]
    amount?: string
}

export const AddWithdrawRouterView: FC<AddWithdrawRouterViewProps> = ({
    flow,
    pageTitle,
    mainHeading,
    onBackClick,
    recentMethods = [],
    amount,
}) => {
    const router = useRouter()
    const [showAllMethods, setShowAllMethods] = useState(recentMethods.length === 0)
    const [searchTerm, setSearchTerm] = useState('')

    const baseRoute = flow === 'add' ? '/add-money' : '/withdraw'

    const allMethodsTransformed: DepositMethod[] = useMemo(() => {
        return ALL_METHODS_DATA.map((method) => {
            let path = `${baseRoute}/${method.path}`
            if (flow === 'withdraw' && method.type === 'crypto' && amount) {
                path = `${path}?amount=${amount}`
            }
            return {
                ...method,
                path: path,
            }
        })
    }, [baseRoute, flow, amount])

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

        methodsToShow.some((method) => {
            if (method.type === 'crypto') {
                method.title = flow === 'add' ? 'Crypto Deposit' : 'Crypto'
                method.description =
                    flow === 'add' ? 'Use an exchange or your wallet' : 'Withdraw to a wallet or exchange'
            }
        })

        return methodsToShow.sort((a, b) => {
            if (a.type === 'crypto' && b.type !== 'crypto') {
                return -1
            }
            if (b.type === 'crypto' && a.type !== 'crypto') {
                return 1
            }
            return a.title.toLowerCase().localeCompare(b.title.toLowerCase())
        })
    }, [searchTerm, allMethodsTransformed])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value)
    }

    const handleClearSearch = () => {
        setSearchTerm('')
    }

    const defaultBackNavigation = () => router.push('/home')

    // todo: save recent methods to local storage
    if (!showAllMethods) {
        return (
            <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
                <NavHeader title={pageTitle} onPrev={onBackClick || defaultBackNavigation} />
                <div className="flex h-full flex-col justify-center space-y-2">
                    <h2 className="text-base font-bold">Recent methods</h2>
                    <DepositMethodList methods={recentMethods} />
                </div>
                <Button icon="plus" className="mt-auto" onClick={() => setShowAllMethods(true)} shadowSize="4">
                    Select new method
                </Button>
            </div>
        )
    }

    // show all methods view
    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader title={pageTitle} onPrev={onBackClick || defaultBackNavigation} />

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
                        <DepositMethodList methods={filteredAllMethods} />
                    </div>
                )}
            </div>
        </div>
    )
}
