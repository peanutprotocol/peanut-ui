'use client'

import { BUILD_ON_US_NOW } from '@/assets'
import { motion } from 'framer-motion'

export default function BuildOnUs() {
    return (
        <div className="bg-primary-1 relative flex min-h-[72vh] flex-col items-center justify-center overflow-x-hidden">
            <motion.div
                className="flex flex-col items-center gap-8"
                initial={{ opacity: 0, translateY: 20 }}
                whileInView={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 10 }}
            >
                <a
                    href="https://peanutprotocol.notion.site/12c83811757980afb3b6d3e5a4c68f4d"
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
                        Integrate
                    </motion.button>
                </a>
                <p className="max-w-[600px] px-4 text-start text-lg text-n-1 md:max-w-[50%]">
                    In awe about Peanut? Want to have something similar in your app or wallet? The app is powered by
                    Peanut Protocol which comes with a powerful set of SDKs and APIs that make any payment as smooth as
                    butter
                </p>
            </motion.div>
        </div>
    )
}
