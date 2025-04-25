'use client'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { SearchInput } from '@/components/SearchUsers/SearchInput'
import { SearchResults } from '@/components/SearchUsers/SearchResults'
import { useUserSearch } from '@/hooks/useUserSearch'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState } from 'react'
import DirectSendInitialView from '../../direct-send/views/Initial.direct.send.view'
import LinkSendFlowManager from '../LinkSendFlowManager'

export const SendRouterView = () => {
    const router = useRouter()
    const inputRef = useRef<HTMLInputElement>(null)
    const [isSendingByLink, setIsSendingByLink] = useState(false)
    const { searchTerm, setSearchTerm, searchResults, isSearching, error, showMinCharError, showNoResults } =
        useUserSearch()
    const searchParams = useSearchParams()
    const type = searchParams.get('type')
    const toUsername = searchParams.get('to')

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value)
    }

    const handleClearSearch = () => {
        setSearchTerm('')
    }

    const handleCreateLink = () => {
        setIsSendingByLink(true)
    }

    const handleUserSelect = (username: string) => {
        router.push(`/send?type=direct&to=${username}`)
    }

    if (isSendingByLink) {
        return <LinkSendFlowManager onPrev={() => setIsSendingByLink(false)} />
    }

    // if type is direct and we have a username, show DirectSend
    if (type === 'direct' && toUsername) {
        return (
            <div className=" flex h-full w-full flex-col justify-start gap-8 self-start">
                <NavHeader onPrev={() => router.push('/send')} title="Send" />
                <DirectSendInitialView username={toUsername} />
            </div>
        )
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
                            recentTransactions={[]} // Will be populated in history project
                            onUserSelect={handleUserSelect}
                        />

                        {error && <div className="mt-2 text-sm text-error">{error}</div>}
                    </div>
                </div>
            </div>
        </div>
    )
}
