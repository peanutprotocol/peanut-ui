'use client'

import Image from 'next/image'
import type { StaticImageData } from 'next/image'
import ActionModal from '../Global/ActionModal'
import ShareButton from '../Global/ShareButton'
import { getBadgeShareText } from './badge.utils'
import { useUserStore } from '@/redux/hooks'
import { BASE_URL } from '@/constants/general.consts'

type BadgeDetailModalProps = {
    isOpen: boolean
    onClose: () => void
    code?: string
    title: string
    description: string
    logo: string | StaticImageData
}

// the focal badge detail popup — large badge image + name + description, plus a
// Share CTA that drops a funny, badge-specific brag into the native share sheet
// (Web Share API, clipboard fallback). Shared by the Your Badges list and the
// badge-unlock drawer so both surfaces show the exact same modal. The modal's
// top-right ✕ is the dismiss affordance now that "Got it" became "Share badge".
export const BadgeDetailModal = ({ isOpen, onClose, code, title, description, logo }: BadgeDetailModalProps) => {
    const { user: authUser } = useUserStore()
    const username = authUser?.user?.username
    // the sharer's own public profile — showcases their badges + carries the join CTA
    const profileUrl = username ? `${BASE_URL}/${username}` : BASE_URL

    return (
        <ActionModal
            icon={<Image height={240} width={240} src={logo} alt={title} className="w-60 object-contain" unoptimized />}
            iconContainerClassName="bg-transparent min-w-60 h-auto"
            modalPanelClassName="m-0"
            visible={isOpen}
            onClose={onClose}
            title={title}
            description={description}
            content={
                <ShareButton
                    title=""
                    className="w-full"
                    onSuccess={onClose}
                    generateText={() => Promise.resolve(getBadgeShareText(code, title, profileUrl))}
                >
                    Share badge
                </ShareButton>
            }
        />
    )
}
