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
    BV: {
        image: '/easter-eggs/bouvet.png',
        caption: '🧊 Population: 0. Banks: also 0.',
        subtitle: 'An uninhabited Norwegian glacier in the South Atlantic',
    },
    CX: {
        image: '/easter-eggs/christmas.png',
        caption: "🦀 Red crabs don't need bank accounts",
        subtitle: '45 million crabs, zero ATMs',
    },
    CC: {
        image: '/easter-eggs/cocos.png',
        caption: '🥥 Coconuts accepted, wire transfers not so much',
        subtitle: 'Population: 544. Financial infrastructure: vibes',
    },
    GS: {
        image: '/easter-eggs/southgeorgia.png',
        caption: '🐧 More penguins than people',
        subtitle: 'South Georgia: 30 researchers, 3 million penguins, 0 banks',
    },
    HM: {
        image: '/easter-eggs/heard.png',
        caption: '🌋 Active volcano, inactive banking sector',
        subtitle: 'Heard Island: uninhabited, unless you count the seals',
    },
    PN: {
        image: '/easter-eggs/pitcairn.png',
        caption: '🏴\u200d☠️ 47 people. 0 ATMs. All vibes.',
        subtitle: "The world's least populated jurisdiction with a .pn domain",
    },
    TK: {
        image: '/easter-eggs/tokelau.png',
        caption: '🌊 No roads, no banks, no problem',
        subtitle: 'Three atolls, 1,500 people, and the .tk domain empire',
    },
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
                    shadowSize: '4',
                    onClick: onClose,
                },
            ]}
        />
    )
}

export default EasterEggModal
