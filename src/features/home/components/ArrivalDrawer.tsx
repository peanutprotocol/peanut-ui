'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { useModalsContext } from '@/context/ModalsContext'
import { useOtherOpenOverlays } from '@/utils/overlay-visibility'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useEffect, useRef } from 'react'
import type { Arrival } from '../arrival.types'

interface ArrivalDrawerProps {
    arrival: Arrival
    /** A Home prompt that outranks this one is up: wait for it. */
    blocked: boolean
    onDismiss: () => void
}

/**
 * What already works in the country the user just arrived in (TASK-23251):
 * a QR in Argentina or Brazil under the country's flag, the card elsewhere.
 * Moves into the attention registry once ui#3667 lands.
 */
export default function ArrivalDrawer({ arrival, blocked, onDismiss }: ArrivalDrawerProps) {
    const t = useTranslations('home.arrival')
    const router = useRouter()
    const { isQRScannerOpen, setIsQRScannerOpen } = useModalsContext()
    const overlayOwner = useRef(Symbol('arrival'))
    const otherOverlayOpen = useOtherOpenOverlays(overlayOwner.current)
    const visible = !blocked && !otherOverlayOpen && !isQRScannerOpen
    const trackedFor = useRef<Arrival | null>(null)
    const isQr = arrival.prompt !== 'card'

    useEffect(() => {
        if (!visible || trackedFor.current === arrival) return
        trackedFor.current = arrival
        posthog.capture(ANALYTICS_EVENTS.ARRIVAL_PROMPT_SHOWN, { country: arrival.country, prompt: arrival.prompt })
    }, [visible, arrival])

    // Unmount while yielding: a closing drawer would keep its overlay over the other prompt.
    if (!visible) return null

    const handleCta = () => {
        posthog.capture(ANALYTICS_EVENTS.ARRIVAL_PROMPT_CTA_CLICKED, {
            country: arrival.country,
            prompt: arrival.prompt,
        })
        // The scanner has no route of its own: it opens over the current screen.
        // Open it first, so Home sees it open in the same render the prompt clears.
        if (isQr) setIsQRScannerOpen(true)
        else router.push('/card')
        onDismiss()
    }

    return (
        <Drawer
            open
            overlayOwner={overlayOwner.current}
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
