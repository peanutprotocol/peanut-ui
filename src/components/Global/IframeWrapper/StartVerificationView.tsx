'use client'

import { PeanutThinking } from '@/assets/mascot'
import { Button } from '@/components/0_Bruddle/Button'
import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import NavHeader from '../NavHeader'

const StartVerificationView = ({
    onStartVerification,
    onClose,
}: {
    onStartVerification: () => void
    onClose: () => void
}) => {
    const t = useTranslations('global')
    return (
        <div className="flex h-full w-full flex-col">
            <div className="relative flex h-[45%] items-center justify-center bg-secondary-3/100">
                <CloudsBackground minimal />
                <Image
                    src={PeanutThinking.src}
                    unoptimized
                    alt="verification"
                    className="relative w-full max-w-72 object-contain md:max-w-80"
                    height={100}
                    width={100}
                />
                <div className="absolute right-5" style={{ top: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
                    <NavHeader icon="cancel" onPrev={onClose} />
                </div>
            </div>

            <div className="flex h-[55%] flex-col bg-white p-4">
                <h1 className="text-3xl font-extrabold">{t('startVerification.title')}</h1>
                <div>
                    <p className="mt-2 text-lg font-medium">{t('startVerification.provider')}</p>
                    <p className="text-lg font-medium">{t('startVerification.practices')}</p>
                    <p className="text-lg font-bold">{t('startVerification.privacy')}</p>
                </div>
                <Button onClick={onStartVerification} className="my-auto" variant="purple" shadowSize="4">
                    {t('startVerification.cta')}
                </Button>
            </div>
        </div>
    )
}

export default StartVerificationView
