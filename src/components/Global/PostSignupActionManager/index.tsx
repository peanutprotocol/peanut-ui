'use client'

import { getRedirectUrl, clearRedirectUrl } from '@/utils/general.utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ActionModal from '../ActionModal'
import { POST_SIGNUP_ACTIONS } from './post-signup-action.consts'
import { type IconName } from '../Icons/Icon'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'

export const PostSignupActionManager = ({
    onActionModalVisibilityChange,
}: {
    onActionModalVisibilityChange: (isVisible: boolean) => void
}) => {
    const [showModal, setShowModal] = useState(false)
    const [actionConfig, setActionConfig] = useState<{
        cta: string
        title: string
        description: string
        icon: IconName
        action: () => void
    } | null>(null)
    const router = useRouter()
    // Post-signup re-engagement gate: did the user finish their ID check? Reads
    // the identity signal directly (Sumsub-cleared) — `isKycApproved` (any rail
    // enabled) over-fires for a card-only Rain user who can't actually act on
    // a bank-claim redirect URL.
    const { isVerified: isIdentityVerified } = useIdentityVerification()

    const checkClaimModalAfterKYC = () => {
        const redirectUrl = getRedirectUrl()
        if (isIdentityVerified && redirectUrl) {
            const matchedAction = POST_SIGNUP_ACTIONS.find((action) => action.pathPattern.test(redirectUrl))
            if (matchedAction) {
                setActionConfig({
                    ...matchedAction.config,
                    action: () => {
                        router.push(redirectUrl)
                        clearRedirectUrl()
                        setShowModal(false)
                    },
                })
                setShowModal(true)
            }
        }
    }

    useEffect(() => {
        checkClaimModalAfterKYC()
    }, [router, isIdentityVerified])

    useEffect(() => {
        onActionModalVisibilityChange(showModal)
    }, [showModal, onActionModalVisibilityChange])

    if (!actionConfig) return null

    return (
        <ActionModal
            visible={showModal}
            onClose={() => {
                setShowModal(false)
                clearRedirectUrl()
            }}
            preventClose // Prevent closing the modal by clicking outside
            title={actionConfig.title}
            description={actionConfig.description}
            icon={actionConfig.icon}
            ctas={[
                {
                    text: actionConfig.cta,
                    onClick: actionConfig.action,
                    variant: 'purple',
                    shadowSize: '4',
                },
            ]}
        />
    )
}
