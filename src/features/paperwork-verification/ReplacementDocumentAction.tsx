'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { findKycReplacementPlan } from '@/app/actions/kyc-workflow'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { identityDocuments } from '@/utils/kyc-document-plan.utils'
import { paperworkVerificationRestartPath } from './paperworkVerificationEntry'

export function ReplacementDocumentAction({
    onTap,
    returnToFeature = false,
}: {
    onTap?: (action: 'retry' | 'support') => void
    returnToFeature?: boolean
}) {
    const t = useTranslations()
    const router = useRouter()
    const modals = useModalsContextOptional()
    const { user } = useAuth()
    const owner = user?.user?.userId
    const [eligibility, setEligibility] = useState<{ owner: string; allowed: boolean }>()
    const navigating = useRef(false)
    const allowed = eligibility?.owner === owner && eligibility?.allowed
    const checking = !!owner && eligibility?.owner !== owner

    useEffect(() => {
        if (!owner) return
        let current = true
        navigating.current = false
        void findKycReplacementPlan()
            .catch(() => null)
            .then((plan) => {
                if (current) {
                    const route = plan?.routes[0]
                    setEligibility({ owner, allowed: !!route && identityDocuments(route).length > 0 })
                }
            })
        return () => {
            current = false
        }
    }, [owner])

    if (!allowed && !checking && !modals) {
        return (
            <Button className="w-full" href="https://peanut.me/support" onClick={() => onTap?.('support')}>
                {t('common.contactSupport')}
            </Button>
        )
    }

    return (
        <Button
            className="w-full"
            data-testid={allowed ? 'verify-replacement-document' : undefined}
            loading={checking}
            disabled={checking}
            onClick={() => {
                if (allowed) {
                    if (navigating.current) return
                    navigating.current = true
                    onTap?.('retry')
                    router.push(paperworkVerificationRestartPath(returnToFeature))
                } else {
                    onTap?.('support')
                    modals?.setIsSupportModalOpen(true)
                }
            }}
        >
            {allowed || checking ? t('kyc.paperworkVerification.policyHold.cta') : t('common.contactSupport')}
        </Button>
    )
}
