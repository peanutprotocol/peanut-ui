'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { useModalsContext } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { AskSurfaceProps } from '@/features/attention/types'
import { currentArrival, dismissArrival, subscribeArrival } from '../arrival-session'
import type { Arrival } from '../arrival.types'

/**
 * What already works in the country the user just arrived in (TASK-23251):
 * a QR in Argentina or Brazil under the country's flag, the card elsewhere.
 * Whether it shows is the attention manager's call (the `arrival` ask).
 */
export default function ArrivalDrawer({ onActed, onDismissed }: AskSurfaceProps) {
    const t = useTranslations('home.arrival')
    const router = useRouter()
    const { setIsQRScannerOpen } = useModalsContext()
    const arrival = useSyncExternalStore(subscribeArrival, currentArrival, () => null)
    const trackedFor = useRef<Arrival | null>(null)

    useEffect(() => {
        if (!arrival || trackedFor.current === arrival) return
        trackedFor.current = arrival
        posthog.capture(ANALYTICS_EVENTS.ARRIVAL_PROMPT_SHOWN, { country: arrival.country, prompt: arrival.prompt })
    }, [arrival])

    if (!arrival) return null
    const isQr = arrival.prompt !== 'card'

    const onDismiss = () => {
        dismissArrival()
        onDismissed()
    }

    const handleCta = () => {
        posthog.capture(ANALYTICS_EVENTS.ARRIVAL_PROMPT_CTA_CLICKED, {
            country: arrival.country,
            prompt: arrival.prompt,
        })
        // The scanner has no route of its own: it opens over the current screen.
        // Open it first, so Home sees it open in the same render the prompt clears.
        if (isQr) setIsQRScannerOpen(true)
        else router.push('/card')
        dismissArrival()
        onActed()
    }

    return (
        <Drawer
            open
            onOpenChange={(isOpen) => {
                if (!isOpen) onDismiss()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it, as in the other Home drawers */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        {isQr ? (
                            // the flag takes the m bubble's 48px; circle-flags are already round
                            <Image
                                src={getFlagUrl(arrival.country)}
                                alt=""
                                width={96}
                                height={96}
                                className="size-12 rounded-full object-cover"
                            />
                        ) : (
                            <IconBubble {...CONCEPT_ICONS.card} />
                        )}
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t(`${arrival.prompt}.title`)}</DrawerTitle>
                            <DrawerDescription>{t(`${arrival.prompt}.description`)}</DrawerDescription>
                        </DrawerHeader>
                    </div>
                    {/* XL/24 between the primary and the tertiary dismiss */}
                    <div className="flex w-full flex-col items-center gap-6">
                        <Button variant="primary" className="w-full" onClick={handleCta}>
                            {t(`${arrival.prompt}.cta`)}
                        </Button>
                        <LinkButton onClick={onDismiss}>{t('notNow')}</LinkButton>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
