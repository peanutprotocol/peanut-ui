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

import { personFrom } from '@/lib/person/person'
import { usePerson } from '@/lib/person/usePerson'
import CenteredStatusCard from '@/components/Global/EmptyStates/CenteredStatusCard'
import { AccountType } from '@/interfaces/interfaces'
import Loading from '@/components/Global/Loading'
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
    const { profile, isLoading, error } = usePerson(username)

    // resolve user to recipient
    const recipient = useMemo<DirectSendRecipient | null>(() => {
        if (!profile) return null

        // find peanut wallet address
        const walletAccount = profile.accounts.find((acc) => acc.type === AccountType.PEANUT_WALLET)
        if (!walletAccount) return null

        return {
            username: profile.username,
            address: walletAccount.identifier as Address,
            userId: profile.userId,
            fullName: profile.fullName,
            person: personFrom(profile),
        }
    }, [profile])

    // loading state
    if (isLoading) {
        return (
            <div className="flex min-h-inherit w-full flex-col gap-4">
                <NavHeader title={t('headers.send')} onPrev={onBack} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <Loading variant="mascot" />
                </div>
            </div>
        )
    }

    // error state — centered card (ruled 2026-09-03: no more lone top banner)
    if (error || !recipient) {
        return (
            <div className="flex min-h-inherit w-full flex-col gap-4">
                <NavHeader title={t('headers.send')} onPrev={onBack} />
                <div className="flex flex-grow flex-col justify-center py-8">
                    <CenteredStatusCard
                        title={t('errors.userNotFoundTitle')}
                        description={t('errors.userNotFoundDescription', { username })}
                    />
                </div>
            </div>
        )
    }

    return <DirectSendPage recipient={recipient} />
}
