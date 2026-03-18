'use client'

import ActionModal from '@/components/Global/ActionModal'
import Image from 'next/image'

export interface EasterEggCountryConfig {
    image: string
    caption: string
    subtitle: string
}

/**
 * Easter egg countries — these places have no banking infrastructure,
 * so we show a fun modal instead of the normal flow.
 */
export const EASTER_EGG_COUNTRIES: Record<string, EasterEggCountryConfig> = {
    AQ: {
        image: '/easter-eggs/antarctica.png',
        caption: '🐧 No banks here, only penguins!',
        subtitle: "Antarctica isn't a real country... yet",
    },
    // More countries can be added here later:
    // BV: { image: '/easter-eggs/bouvet.png', caption: '...', subtitle: '...' },
    // CX: { image: '/easter-eggs/christmas.png', caption: '...', subtitle: '...' },
    // CC: { image: '/easter-eggs/cocos.png', caption: '...', subtitle: '...' },
    // GS: { image: '/easter-eggs/southgeorgia.png', caption: '...', subtitle: '...' },
    // HM: { image: '/easter-eggs/heard.png', caption: '...', subtitle: '...' },
    // PN: { image: '/easter-eggs/pitcairn.png', caption: '...', subtitle: '...' },
    // TK: { image: '/easter-eggs/tokelau.png', caption: '...', subtitle: '...' },
}

interface EasterEggModalProps {
    visible: boolean
    onClose: () => void
    countryCode: string
}

const EasterEggModal = ({ visible, onClose, countryCode }: EasterEggModalProps) => {
    const config = EASTER_EGG_COUNTRIES[countryCode]
    if (!config) return null

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={config.caption}
            description={config.subtitle}
            icon={
                <Image
                    src={config.image}
                    alt="Easter egg"
                    width={400}
                    height={400}
                    className="h-auto w-full"
                    priority
                />
            }
            iconContainerClassName="size-auto rounded-none bg-transparent w-full"
            ctas={[
                {
                    text: 'Got it',
                    variant: 'stroke',
                    onClick: onClose,
                },
            ]}
        />
    )
}

export default EasterEggModal
