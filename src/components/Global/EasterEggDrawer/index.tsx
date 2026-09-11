'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Icon } from '@/components/Global/Icons/Icon'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
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

interface EasterEggDrawerProps {
    visible: boolean
    onClose: () => void
    countryCode: string
}

const EasterEggDrawer = ({ visible, onClose, countryCode }: EasterEggDrawerProps) => {
    const t = useTranslations('global')
    const tCommon = useTranslations('common')
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
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        {/* upside-down smile in the standard pink bubble: the joke is the tone, not a status */}
                        <IconBubble
                            icon={<Icon name="smile" size={24} className="rotate-180 text-black" />}
                            className="bg-action-primary"
                        />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{countryCopy.caption}</DrawerTitle>
                            <DrawerDescription>{countryCopy.subtitle}</DrawerDescription>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        <Image
                            src={config.image}
                            alt={t('easterEggImageAlt')}
                            width={400}
                            height={400}
                            className="h-auto w-full"
                            priority
                        />
                        <Button variant="stroke" shadowSize="4" className="w-full justify-center" onClick={onClose}>
                            {tCommon('gotIt')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default EasterEggDrawer
