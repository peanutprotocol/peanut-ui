'use client'

import { saveRedirectUrl } from '@/utils/general.utils'
import ActionModal from '../ActionModal'
import { useRouter } from 'next/navigation'
import { generateInviteCodeLink } from '@/utils'

interface GuestVerificationModalProps {
    description: string
    isOpen: boolean
    onClose: () => void
    secondaryCtaLabel: string
    redirectToVerification?: boolean
    inviterUsername?: string
}

export const GuestVerificationModal = ({
    isOpen,
    onClose,
    description,
    secondaryCtaLabel,
    redirectToVerification,
    inviterUsername,
}: GuestVerificationModalProps) => {
    const router = useRouter()
    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            title="This method requires verification"
            description={description}
            icon="alert"
            iconContainerClassName="bg-yellow-400"
            ctaClassName="md:flex-col gap-4"
            ctas={[
                {
                    text: 'Start verification',
                    shadowSize: '4',
                    className: 'md:py-2.5',
                    onClick: () => {
                        saveRedirectUrl()
                        if (inviterUsername) {
                            const { inviteLink } = generateInviteCodeLink(inviterUsername)
                            router.push(inviteLink)
                        } else if (redirectToVerification) {
                            router.push('/setup?redirect_uri=/profile/identity-verification')
                            return
                        } else {
                            router.push('/setup')
                        }
                    },
                },
                {
                    text: secondaryCtaLabel,
                    variant: 'transparent',
                    className: 'w-full h-auto underline font-semibold text-sm underline-offset-2',
                    onClick: () => {
                        onClose()
                    },
                },
            ]}
            preventClose={false}
            modalPanelClassName="max-w-md mx-8"
        />
    )
}
