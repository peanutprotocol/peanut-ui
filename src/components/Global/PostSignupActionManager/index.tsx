'use client'

import { getFromLocalStorage } from '@/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ActionModal from '../ActionModal'
import { POST_SIGNUP_ACTIONS } from './post-signup-action.consts'
import { IconName } from '../Icons/Icon'
import { KycFlow } from '@/components/Kyc/KycFlow'

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

    useEffect(() => {
        const redirectUrl = getFromLocalStorage('redirect')
        const showVerificationModal = localStorage.getItem('showVerificationModal')
        if (redirectUrl && showVerificationModal === 'true') {
            const matchedAction = POST_SIGNUP_ACTIONS.find((action) => action.pathPattern.test(redirectUrl))

            if (matchedAction) {
                setActionConfig({
                    ...matchedAction.config,
                    action: () => {
                        router.push(redirectUrl)
                        localStorage.removeItem('redirect')
                        setShowModal(false)
                    },
                })
                setShowModal(true)
            }
        }
    }, [router])

    useEffect(() => {
        onActionModalVisibilityChange(showModal)
    }, [showModal, onActionModalVisibilityChange])

    if (!actionConfig) return null

    return (
        <ActionModal
            visible={showModal}
            onClose={() => {
                setShowModal(false)
                localStorage.removeItem('redirect')
                localStorage.removeItem('showVerificationModal')
            }}
            title={actionConfig.title}
            description={actionConfig.description}
            icon={actionConfig.icon as IconName}
            customContent={<KycFlow />}
            // ctas={[
            //     {
            //         text: actionConfig.cta,
            //         onClick: actionConfig.action,
            //         variant: 'purple',
            //         shadowSize: '4',
            //     },
            // ]}
        />
    )
}
