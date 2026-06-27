import Image from 'next/image'
import type { StaticImageData } from 'next/image'
import ActionModal from '../Global/ActionModal'

type BadgeDetailModalProps = {
    isOpen: boolean
    onClose: () => void
    title: string
    description: string
    logo: string | StaticImageData
}

// the focal badge detail popup — large badge image + name + description.
// shared by the Your Badges list and the badge-unlock drawer so both
// surfaces show the exact same modal.
export const BadgeDetailModal = ({ isOpen, onClose, title, description, logo }: BadgeDetailModalProps) => (
    <ActionModal
        icon={<Image height={240} width={240} src={logo} alt={title} className="w-60 object-contain" unoptimized />}
        iconContainerClassName="bg-transparent min-w-60 h-auto"
        modalPanelClassName="m-0"
        visible={isOpen}
        onClose={onClose}
        title={title}
        description={description}
        ctas={[
            {
                text: 'Got it!',
                onClick: onClose,
                shadowSize: '4',
            },
        ]}
    />
)
