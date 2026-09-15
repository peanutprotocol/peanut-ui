'use client'

import Image from 'next/image'
import { Card } from '@/components/0_Bruddle/Card'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PeanutThinking } from '@/assets/mascot'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

/** Captioned waiting card with the thinking mascot peeking over it. */
export const QrPayPageLoading = ({ message }: { message: string }) => {
    const t = useAppTranslations('qrPay')
    return (
        <PageStack>
            <PageStack.Center className="items-center gap-4">
                <div className="relative">
                    <Image
                        src={PeanutThinking}
                        unoptimized
                        alt={t('peanutManAlt')}
                        width={128}
                        height={128}
                        // spans the card wrapper (the modern equivalent of the old
                        // layout="fill") so object-contain centers the mascot over
                        // the card instead of parking it at the top-left corner
                        className="absolute inset-0 z-0 h-full w-full -translate-y-20 object-contain"
                    />

                    <Card className="relative z-10 w-full items-center gap-4 p-4">
                        <IconBubble icon="clock" color="yellow" size="m" />
                        <p className="text-body-m">{message}</p>
                    </Card>
                </div>
            </PageStack.Center>
        </PageStack>
    )
}
