'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { BUILD_ON_US_NOW } from '@/assets'

export default function BuildOnUs() {
    return (
        <div className="relative flex min-h-[72vh] flex-col items-center justify-center overflow-x-hidden bg-pink-1">
            <motion.div
                className="flex flex-col items-center gap-8"
                initial={{ opacity: 0, translateY: 20 }}
                whileInView={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 10 }}
            >
                <a
                    href="https://peanutprotocol.notion.site/12c83811757980afb3b6d3e5a4c68f4d?pvs=4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-6"
                >
                    <motion.img
                        src={BUILD_ON_US_NOW.src}
                        alt="Build on Peanut Protocol"
                        className="h-auto max-w-[90%] cursor-pointer"
                        whileHover={{ scale: 1.05 }}
                    />
                    <motion.button
                        className="btn-purple px-8 py-3 text-lg font-semibold shadow-lg"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Start Building Now
                    </motion.button>
                </a>
                <p className="text-center text-lg text-n-1">
                    Join the ecosystem of apps building the future of payments
                </p>
            </motion.div>
        </div>
    )
}
