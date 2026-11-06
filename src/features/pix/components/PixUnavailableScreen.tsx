'use client'

import { useTranslations } from 'next-intl'
import { MantecaAccountUnavailable } from '@/components/Common/MantecaAccountUnavailable'
import { useModalsContext } from '@/context/ModalsContext'
import { useSafeBack } from '@/hooks/useSafeBack'

/** No provider serves Pix for this user, or the API sent no route. */
export function PixUnavailableScreen({ title }: { title: string }) {
    const tShared = useTranslations('avenia')
    const { setIsSupportModalOpen } = useModalsContext()
    const back = useSafeBack('/home')
    return (
        <MantecaAccountUnavailable
            title={title}
            description={tShared('unavailable')}
            onBack={back}
            onSupport={() => setIsSupportModalOpen(true)}
        />
    )
}
