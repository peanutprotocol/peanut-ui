'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'

/**
 * Apple's "row selector" for in-app provisioning: the unaltered Apple Pay mark
 * followed by text matching PKAddPassButton. Apple forbids issuer-drawn Add to
 * Apple Wallet buttons, and the passkey step-up before Apple's sheet rules out
 * PKAddPassButton itself (no interstitial screens allowed after it), so this
 * row is the compliant control. Show it only when it starts the native add.
 */
export default function AppleWalletRow({ isAdding, onClick }: { isAdding: boolean; onClick: () => void }) {
    const t = useTranslations('card.yourCard')

    return (
        <ListGroup>
            <ListItem
                title={t('addToAppleWallet')}
                leading={
                    <Image
                        src="/wallet/apple/apple-pay-mark.svg"
                        width={50}
                        height={32}
                        alt=""
                        aria-hidden
                        unoptimized
                        className="h-8 w-auto shrink-0"
                    />
                }
                disabled={isAdding}
                aria-label={t('addToAppleWallet')}
                onClick={onClick}
            />
        </ListGroup>
    )
}
