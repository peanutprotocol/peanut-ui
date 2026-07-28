'use client'

import ActionModal from '@/components/Global/ActionModal'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

export interface EasterEggCountryConfig {
    image: string
}

/**
 * Easter egg countries — these places have no banking infrastructure,
 * so we show a fun modal instead of the normal flow.
 */
export const EASTER_EGG_COUNTRIES: Record<string, EasterEggCountryConfig> = {
    AQ: { image: '/easter-eggs/antarctica.webp' },
    BV: { image: '/easter-eggs/bouvet.webp' },
    CX: { image: '/easter-eggs/christmas.webp' },
    CC: { image: '/easter-eggs/cocos.webp' },
    GS: { image: '/easter-eggs/southgeorgia.webp' },
    HM: { image: '/easter-eggs/heard.webp' },
    PN: { image: '/easter-eggs/pitcairn.webp' },
    TK: { image: '/easter-eggs/tokelau.webp' },
}

interface EasterEggModalProps {
    visible: boolean
    onClose: () => void
    countryCode: string
}

const EasterEggModal = ({ visible, onClose, countryCode }: EasterEggModalProps) => {
    const t = useTranslations('global')
    const config = EASTER_EGG_COUNTRIES[countryCode]
    // Spelled out rather than built from a template key so next-intl's typed messages still check them.
    const copy: Record<string, { caption: string; subtitle: string }> = {
        AQ: { caption: t('easterEggModal.AQ.caption'), subtitle: t('easterEggModal.AQ.subtitle') },
        BV: { caption: t('easterEggModal.BV.caption'), subtitle: t('easterEggModal.BV.subtitle') },
        CX: { caption: t('easterEggModal.CX.caption'), subtitle: t('easterEggModal.CX.subtitle') },
        CC: { caption: t('easterEggModal.CC.caption'), subtitle: t('easterEggModal.CC.subtitle') },
        GS: { caption: t('easterEggModal.GS.caption'), subtitle: t('easterEggModal.GS.subtitle') },
        HM: { caption: t('easterEggModal.HM.caption'), subtitle: t('easterEggModal.HM.subtitle') },
        PN: { caption: t('easterEggModal.PN.caption'), subtitle: t('easterEggModal.PN.subtitle') },
        TK: { caption: t('easterEggModal.TK.caption'), subtitle: t('easterEggModal.TK.subtitle') },
    }
    const countryCopy = copy[countryCode]
    if (!config || !countryCopy) return null

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={countryCopy.caption}
            description={countryCopy.subtitle}
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
                    text: t('easterEggModal.gotItCta'),
                    variant: 'stroke',
                    shadowSize: '4',
                    onClick: onClose,
                },
            ]}
        />
    )
}

export default EasterEggModal
