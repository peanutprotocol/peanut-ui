'use client'

import { getRedirectUrl, clearRedirectUrl } from '@/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ActionModal from '../ActionModal'
import { POST_SIGNUP_ACTIONS } from './post-signup-action.consts'
import { type IconName } from '../Icons/Icon'
import { useAuth } from '@/context/authContext'

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
        icon: any
        action: () => void
    } | null>(null)
    const router = useRouter()
    const { user } = useAuth()

    const checkClaimModalAfterKYC = () => {
        const redirectUrl = getRedirectUrl()
        if (user?.user.bridgeKycStatus === 'approved' && redirectUrl) {
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
    }, [router, user])

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
            icon={actionConfig.icon as IconName}
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
