'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import handPeace from '@/assets/illustrations/hand-peace.svg'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import { Icon } from '@/components/Global/Icons/Icon'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { PushBanner } from './PushBanner'

/**
 * 10 hero (mock screens/10-notifications): two push banners, the bell, the peace glove, two stars. Entrance
 * once, then still; `ring` (Turn on) rings the bell once (MOTION 7). The same art in every arm.
 */
export function NotificationsArt({ ring }: { ring: number }) {
    const t = useTranslations('setupRedesign.notif')
    const { reducedMotion } = useSetupShell()
    const sm = useShellDevice() === 'sm'
    return (
        <div className="absolute inset-0" data-testid="setup-redesign-art">
            <ArtPiece left={46} top={236} rotate={-3} entrance="deal" order={1} zIndex={6}>
                <PushBanner title={t('push1Title')} body={t('push1Body')} />
            </ArtPiece>
            <ArtPiece left={30} top={320} rotate={2} entrance="deal" zIndex={5}>
                <PushBanner title={t('push2Title')} body={t('push2Body')} />
            </ArtPiece>
            {/* small phones: the bell sits on the first banner's corner instead of under the headline */}
            <ArtPiece left={sm ? 6 : 18} top={sm ? 228 : 196} rotate={-14} entrance="pop" order={3} zIndex={7}>
                <motion.div
                    key={ring}
                    initial={false}
                    animate={
                        ring > 0 && !reducedMotion
                            ? { rotate: [0, 26, -26, 26, -26, 26, -26, 26, 0], transition: { duration: 0.52 } }
                            : undefined
                    }
                    style={{ transformOrigin: '50% 8%' }}
                >
                    <Icon name="bell" size={36} className="block" />
                </motion.div>
            </ArtPiece>
            <ArtPiece left={300} top={340} width={70} rotate={-8} entrance="pop" order={4} zIndex={8}>
                <Image src={handPeace} alt="" className="block h-auto w-full" />
            </ArtPiece>
            <ArtPiece left={350} top={206} width={22} entrance="pop" order={5} zIndex={7} smHide>
                <Image src={star} alt="" className="block h-auto w-full" />
            </ArtPiece>
            <ArtPiece left={300} top={192} width={22} rotate={-20} entrance="pop" order={6} zIndex={7} smHide>
                <Image src={sparkle} alt="" className="block h-auto w-full" />
            </ArtPiece>
        </div>
    )
}
