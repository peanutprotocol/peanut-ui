'use client'

import Image from 'next/image'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { PeanutThinking } from '@/assets/mascot'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

/** Captioned waiting card with the thinking mascot peeking over it. */
export const QrPayPageLoading = ({ message }: { message: string }) => {
    const t = useAppTranslations('qrPay')
    return (
        <div className="my-auto space-y-4 flex h-full w-full flex-col items-center justify-center">
            <div className="relative">
                <Image
                    src={PeanutThinking}
                    unoptimized
                    alt={t('peanutManAlt')}
                    width={128}
                    height={128}
                    className="absolute z-0 h-32 w-32 -translate-y-20 object-contain"
                />

                <Card className="relative z-10 flex w-full flex-col items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action-secondary p-3">
                        <Icon name="clock" size={24} />
                    </div>
                    <p className="font-medium">{message}</p>
                </Card>
            </div>
        </div>
    )
}
