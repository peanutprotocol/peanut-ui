'use client'

import { motion } from 'framer-motion'
import { CashoutNow } from '@/assets'

export function CashoutSection() {
    return (
        <div className="relative flex min-h-[72vh] flex-col items-center justify-center overflow-x-hidden bg-pink-1">
            <motion.img
                src={CashoutNow.src}
                className="h-auto max-w-[90%] cursor-pointer"
                alt="Cashout Now"
                initial={{ opacity: 0, translateY: 20 }}
                whileInView={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 10 }}
                onClick={() => (window.location.href = '/cashout')}
                whileHover={{ scale: 1.05 }}
            />
        </div>
    )
}
