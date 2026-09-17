'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { PeanutWalking } from '@/assets/mascot'
import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { countryWaitlist, type CountryWaitlistFlow } from '@/services/country-waitlist'

export function CountryWaitlist({
    countryCode,
    countryName,
    flow,
    onClose,
}: {
    countryCode: string
    countryName: string
    flow: CountryWaitlistFlow
    onClose: () => void
}) {
    const t = useTranslations('global.countryWaitlist')
    const tCommon = useTranslations('common')
    const { userId } = useAuth()
    const { setIsSignInModalOpen } = useModalsContext()
    const queryClient = useQueryClient()
    const queryKey = ['country-waitlist', userId, countryCode, flow]
    const { data, isLoading, isError } = useQuery({
        queryKey,
        queryFn: () => countryWaitlist(countryCode, flow, 'GET'),
        enabled: !!userId,
    })
    const [joining, setJoining] = useState(false)
    const [failed, setFailed] = useState(false)
    const join = async () => {
        if (!userId) {
            setIsSignInModalOpen(true)
            return
        }
        setJoining(true)
        setFailed(false)
        try {
            const result = await countryWaitlist(countryCode, flow, 'POST')
            if (!result.joinedAt) throw new Error('Waitlist signup was not recorded')
            queryClient.setQueryData(queryKey, result)
        } catch {
            setFailed(true)
        } finally {
            setJoining(false)
        }
    }

    return (
        <Drawer
            open
            onOpenChange={(open) => {
                if (!open) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center gap-6 py-6 text-center">
                    <Image src={PeanutWalking} unoptimized alt="" aria-hidden className="h-32 w-auto" />
                    <DrawerHeader className="p-0 text-center sm:text-center">
                        <DrawerTitle>
                            {data?.joinedAt ? t('joinedTitle') : t('title', { country: countryName })}
                        </DrawerTitle>
                        <DrawerDescription>
                            {data?.joinedAt ? t('joinedBody', { country: countryName }) : t('body')}
                        </DrawerDescription>
                    </DrawerHeader>
                    {(failed || isError) && <Notification priority="error">{t('error')}</Notification>}
                    {data?.joinedAt ? (
                        <Button className="w-full" onClick={onClose}>
                            {tCommon('gotIt')}
                        </Button>
                    ) : (
                        <Button
                            className="w-full"
                            onClick={join}
                            loading={joining || isLoading}
                            disabled={joining || isLoading}
                        >
                            {t('join')}
                        </Button>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
