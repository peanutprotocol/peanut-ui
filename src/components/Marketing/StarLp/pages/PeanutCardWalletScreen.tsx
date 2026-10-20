'use client'

import { motion } from 'framer-motion'
import { Icon } from '@/components/Global/Icons/Icon'
import { STAR_LP_SPRING } from '@/components/Marketing/StarLp/starLp.consts'
import { PeanutCardContactless } from './PeanutCardContactless'
import { PeanutCardHeroFace } from './PeanutCardHeroFace'
import type { PeanutCardWalletScreenProps } from './peanutCard.types'

/**
 * The phone's wallet pay sheet (drawn: it is OS UI, which no fixture renders),
 * sized to the receipt it covers: the Peanut Card on the left, "Hold near
 * reader" on the right, nothing branded. When the reader approves, the
 * contactless mark turns into a check, as the OS does.
 */
export function PeanutCardWalletScreen({ approved }: PeanutCardWalletScreenProps) {
    return (
        <div className="flex h-full items-center gap-3 bg-gray-950 px-4 text-white">
            <div className="w-[58%] -rotate-2">
                <PeanutCardHeroFace />
            </div>
            <div className="flex flex-1 flex-col items-center gap-2 text-center">
                <span className="grid size-10 place-items-center">
                    {approved ? (
                        <motion.span
                            className="grid size-10 place-items-center rounded-full border-2 border-white"
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={STAR_LP_SPRING.drop}
                        >
                            <Icon name="check" size={22} />
                        </motion.span>
                    ) : (
                        <PeanutCardContactless className="size-10" />
                    )}
                </span>
                <span className="text-label-l">{approved ? 'Done' : 'Hold near reader'}</span>
            </div>
        </div>
    )
}
