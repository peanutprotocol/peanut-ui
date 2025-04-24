'use client'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { SearchInput } from '@/components/SearchUsers/SearchInput'
import { SearchResults } from '@/components/SearchUsers/SearchResults'
import { useUserSearch } from '@/hooks/useUserSearch'
import { useRef, useState } from 'react'
import SendFlowManager from '../SendFlowManager'

export const SendRouterView = () => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [isSendingByLink, setIsSendingByLink] = useState(false)
    const { searchTerm, setSearchTerm, searchResults, isSearching, error, showMinCharError, showNoResults } =
        useUserSearch()

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value)
    }

    const handleClearSearch = () => {
        setSearchTerm('')
    }

    const handleCreateLink = () => {
        setIsSendingByLink(true)
    }

    if (isSendingByLink) {
        return <SendFlowManager onPrev={() => setIsSendingByLink(false)} />
    }

    return (
        <div className=" flex h-full w-full flex-col justify-start gap-8 self-start">
            {/* Header */}
            <NavHeader title="Send" />

            <div className="space-y-6">
                {/* Link Card */}
                <Card
                    position="single"
                    onClick={handleCreateLink}
                    className="shadow-4 flex cursor-pointer items-center justify-between bg-primary-1 p-4"
                >
                    <div>
                        <h2 className="font-bold">Pay anyone with a link!</h2>
                        <p className="text-sm">Create a link and send them money</p>
                    </div>

                    <Icon name="chevron-up" size={32} className="rotate-90" />
                </Card>

                {/* Search Section */}
                <div className="flex flex-col gap-4">
                    <SearchInput
                        value={searchTerm}
                        onChange={handleSearchChange}
                        onClear={handleClearSearch}
                        inputRef={inputRef}
                    />

                    <div className="flex-1 overflow-hidden">
                        <SearchResults
                            searchTerm={searchTerm}
                            results={searchResults}
                            isSearching={isSearching}
                            showMinCharError={showMinCharError}
                            showNoResults={showNoResults}
                            recentTransactions={[]} // Will be populated from history project
                        />

                        {error && <div className="mt-2 text-sm text-error">{error}</div>}
                    </div>
                </div>
            </div>
        </div>
    )
}
