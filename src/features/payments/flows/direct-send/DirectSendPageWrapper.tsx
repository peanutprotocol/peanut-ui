'use client'

/**
 * wrapper component for DirectSendPage
 *
 * handles async username resolution before rendering the actual flow.
 * finds the user's peanut wallet address from their username.
 *
 * shows loading/error states while resolving
 *
 * used by: /send/[...username] route
 */

import { useUserByUsername } from '@/hooks/useUserByUsername'
import { AccountType } from '@/interfaces'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { type Address } from 'viem'
import type { DirectSendRecipient } from './DirectSendFlowContext'
import { DirectSendPage } from './DirectSendPage'

interface DirectSendPageWrapperProps {
    username: string
}

export function DirectSendPageWrapper({ username }: DirectSendPageWrapperProps) {
    const router = useRouter()
    const { user, isLoading, error } = useUserByUsername(username)

    // resolve user to recipient
    const recipient = useMemo<DirectSendRecipient | null>(() => {
        if (!user) return null

        // find peanut wallet address
        const walletAccount = user.accounts.find((acc) => acc.type === AccountType.PEANUT_WALLET)
        if (!walletAccount) return null

        return {
            username: user.username,
            address: walletAccount.identifier as Address,
            userId: user.userId,
            fullName: user.fullName,
        }
    }, [user])

    // loading state
    if (isLoading) {
        return (
            <div className="flex min-h-[inherit] w-full flex-col gap-4">
                <NavHeader title="Send" onPrev={() => router.back()} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <PeanutLoading />
                </div>
            </div>
        )
    }

    // error state
    if (error || !recipient) {
        return (
            <div className="flex w-full flex-col gap-4">
                <NavHeader title="Send" onPrev={() => router.back()} />
                <ErrorAlert description={error || `user @${username} not found or has no peanut wallet`} />
            </div>
        )
    }

    return <DirectSendPage recipient={recipient} />
}
