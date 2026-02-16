'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/0_Bruddle/Button'

export function SendInSecondsCTA() {
    return (
        <div className="relative mt-12 inline-block md:mt-24">
            <motion.div
                className="relative"
                initial={{ opacity: 0, translateY: 4, translateX: 0, rotate: 0.75 }}
                animate={{ opacity: 1, translateY: 0, translateX: 0, rotate: 0, scale: 1, pointerEvents: 'auto' as const }}
                whileHover={{ translateY: 6, translateX: 0, rotate: 0.75 }}
                transition={{ type: 'spring', damping: 15 }}
            >
                <a href="/send">
                    <Button
                        shadowSize="4"
                        className="bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl"
                    >
                        SEND NOW
                    </Button>
                </a>
            </motion.div>
        </div>
    )
}
