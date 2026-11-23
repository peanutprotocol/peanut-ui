'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'
import type { PeanutCardCtaProps } from './peanutCard.types'
import { usePeanutCardCta } from './usePeanutCardCta'

/**
 * The card CTA, with its own routing rather than StarLpCta's (see
 * usePeanutCardCta), including badge-campaign links that used to land on
 * /shhhhh. The page has two (hero and close); clicks carry
 * `placement`. A click made while auth loads shows the spinner until it runs.
 */
export function PeanutCardCta({ placement }: PeanutCardCtaProps) {
    const { href, onClick, queued, storeHandoffModal } = usePeanutCardCta(placement)

    return (
        <>
            <Button
                prefetch={false}
                href={href}
                variant="secondary"
                size="large"
                loading={queued}
                className={`w-fit ${CTA_MOTION}`}
                onClick={onClick}
            >
                Get your virtual card
            </Button>
            {storeHandoffModal}
        </>
    )
}
