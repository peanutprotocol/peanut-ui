'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import Image from 'next/image'
import PEANUT_LOGO_BLACK from '@/assets/logos/peanut-logo-dark.svg'
import { PEANUTMAN } from '@/assets/mascot'
import ActionModal from '@/components/Global/ActionModal'
import { PeanutWhistling } from '@/assets/mascot'

const NoMoreJailModal = () => {
    const t = useTranslations('global')
    const [isOpen, setisOpen] = useState(false)

    const onClose = () => {
        posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, { modal_type: MODAL_TYPES.POST_SIGNUP, cta: 'start_using' })
        setisOpen(false)
        sessionStorage.removeItem('showNoMoreJailModal')
    }

    useEffect(() => {
        const showNoMoreJailModal = sessionStorage.getItem('showNoMoreJailModal')
        if (showNoMoreJailModal === 'true') {
            setisOpen(true)
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.POST_SIGNUP })
        }
    }, [])

    return (
        <ActionModal
            hideOverlay
            visible={isOpen}
            onClose={onClose}
            title={t('noMoreJailModal.title')}
            description={
                <p>
                    {t('noMoreJailModal.line1')}
                    <br />
                    {t('noMoreJailModal.line2')}
                </p>
            }
            ctas={[
                {
                    text: '',
                    shadowSize: '4',
                    variant: 'purple',
                    onClick: onClose,
                    children: (
                        <>
                            <div>{t('noMoreJailModal.startUsingCta')}</div>
                            <div className="flex items-center gap-1">
                                <Image src={PEANUTMAN} alt="Peanut Logo" className="size-5" />
                                <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                            </div>
                        </>
                    ),
                },
            ]}
            footer={
                <div
                    className="absolute top-7 left-0 flex w-full justify-center"
                    style={{ transform: 'translateY(-80%)' }}
                >
                    <div className="relative h-42 w-[90%] md:h-52">
                        <Image src={PeanutWhistling.src} unoptimized alt="Peanut Man" className="object-contain" fill />
                    </div>
                </div>
            }
        />
    )
}

export default NoMoreJailModal
