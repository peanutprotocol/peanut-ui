'use client'
import { Button } from '@/components/0_Bruddle/Button'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import NavHeader from '@/components/Global/NavHeader'
import { SearchInput } from '@/components/SearchUsers/SearchInput'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ALL_DEPOSIT_METHODS } from '../AddMoney.consts'
import { DepositMethodList } from '../components/DepositMethodList'

export const AddMoneyRouterView = () => {
    const router = useRouter()
    const [showAllMethods, setShowAllMethods] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    const filteredAllMethods = useMemo(() => {
        let methodsToShow
        if (!searchTerm) {
            methodsToShow = [...ALL_DEPOSIT_METHODS]
        } else {
            methodsToShow = ALL_DEPOSIT_METHODS.filter(
                (method) =>
                    method.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    method.currency?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    method.description?.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        return methodsToShow.sort((a, b) => {
            if (a.type === 'crypto' && b.type !== 'crypto') {
                return -1
            }
            if (b.type === 'crypto' && a.type !== 'crypto') {
                return 1
            }
            return a.title.toLowerCase().localeCompare(b.title.toLowerCase())
        })
    }, [searchTerm])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value)
    }

    const handleClearSearch = () => {
        setSearchTerm('')
    }

    // todo: save recent methods in local storage
    if (showAllMethods) {
        return (
            <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
                <NavHeader title="Add Money" onPrev={() => router.push('/home')} />
                <div className="flex h-full flex-col justify-center space-y-2">
                    <h2 className="text-base font-bold">Recent methods</h2>
                    <DepositMethodList methods={[]} />
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
            <NavHeader
                title="Add Money"
                onPrev={() => {
                    setShowAllMethods(false)
                    router.push('/home')
                }}
            />

            <div className="flex h-full flex-col justify-center space-y-2">
                <h2 className="text-base font-bold">Where to add money from?</h2>

                <SearchInput
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onClear={handleClearSearch}
                    placeholder="Search"
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
