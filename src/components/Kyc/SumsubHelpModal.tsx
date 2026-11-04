'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { type ButtonVariant } from '@/components/0_Bruddle/Button'
import { useModalsContext } from '@/context/ModalsContext'
import type { SumsubHelpModalVariant } from './sumsubSdk.types'
import { useKycControl } from '@/features/paperwork-verification/analytics'

interface SumsubHelpModalProps {
    visible: boolean
    variant: SumsubHelpModalVariant
    /** closes just this help modal */
    onDismiss: () => void
    /** closes the whole KYC modal (stop-verification confirm) */
    onExit: () => void
}

/**
 * The trouble/stop-verification confirmation shown over the Sumsub web modal.
 * Rendered outside the outer Modal to avoid pointer-events-none blocking clicks.
 */
export function SumsubHelpModal({ visible, variant, onDismiss, onExit }: SumsubHelpModalProps) {
    const { track } = useKycControl('id-check', 'kyc_legacy')
    const { setIsSupportModalOpen } = useModalsContext()
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')

    const modalDetails = useMemo(() => {
        if (variant === 'trouble') {
            return {
                title: t('wrapper.troubleTitle'),
                description: t('wrapper.troubleDescription'),
                tone: 'info' as const,
                icon: 'question-mark' as IconName,
                ctas: [
                    {
                        text: t('wrapper.chatWithSupport'),
                        onClick: () => {
                            track('support', 'tap')
                            setIsSupportModalOpen(true)
                        },
                        variant: 'primary' as ButtonVariant,
                        shadowSize: '4' as const,
                    },
                ],
                tertiaryCta: {
                    text: tCommon('cancel'),
                    onClick: () => {
                        track('cancel', 'tap')
                        onDismiss()
                    },
                },
            }
        }

        return {
            title: t('wrapper.exitForNowTitle'),
            description: t('wrapper.exitForNowDescription'),
            tone: 'attention' as const,
            icon: 'alert' as IconName,
            ctas: [
                {
                    text: t('wrapper.exit'),
                    onClick: () => {
                        track('exit', 'tap')
                        onDismiss()
                        onExit()
                    },
                    variant: 'primary' as ButtonVariant,
                    shadowSize: '4' as const,
                },
            ],
            tertiaryCta: {
                text: tCommon('continue'),
                onClick: () => {
                    track('continue', 'tap')
                    onDismiss()
                },
            },
        }
    }, [variant, onDismiss, onExit, setIsSupportModalOpen, t, tCommon, track])

    return (
        <ActionModal
            visible={visible}
            onClose={() => {
                track('help', 'dismiss')
                onDismiss()
            }}
            title={modalDetails.title}
            description={modalDetails.description}
            tone={modalDetails.tone}
            icon={modalDetails.icon}
            modalPanelClassName="mx-0 max-w-full"
            ctaClassName="grid grid-cols-1 gap-3"
            contentContainerClassName="px-6 py-6"
            modalClassName="!z-[10001]"
            preventClose={true}
            ctas={modalDetails.ctas}
            tertiaryCta={modalDetails.tertiaryCta}
        />
    )
}
