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
import { AccountType } from '@/interfaces/interfaces'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useMemo } from 'react'
import { type Address } from 'viem'
import type { DirectSendRecipient } from './DirectSendFlowContext'
import { DirectSendPage } from './DirectSendPage'
import { useTranslations } from 'next-intl'

interface DirectSendPageWrapperProps {
    username: string
}

export function DirectSendPageWrapper({ username }: DirectSendPageWrapperProps) {
    const onBack = useSafeBack('/home')
    const t = useTranslations('payment')
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
                <NavHeader title={t('headers.send')} onPrev={onBack} />
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
                <NavHeader title={t('headers.send')} onPrev={onBack} />
                <ErrorAlert description={error || t('errors.userNotFound', { username })} />
            </div>
        )
    }

    return <DirectSendPage recipient={recipient} />
}
