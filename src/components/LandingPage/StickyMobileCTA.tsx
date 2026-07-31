'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/0_Bruddle/Button'
import { MIGRATION_SURFACES, STORE_URL } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { trackStoreClick } from '@/utils/migration.utils'

export function StickyMobileCTA() {
    const [visible, setVisible] = useState(false)
    const rafId = useRef(0)
    const lastVisible = useRef(false)
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const store = deviceType === DeviceType.ANDROID ? 'android' : 'ios'

    useEffect(() => {
        const check = () => {
            const next = window.scrollY >= 300

            if (next !== lastVisible.current) {
                lastVisible.current = next
                setVisible(next)
            }
        }

        const onScroll = () => {
            cancelAnimationFrame(rafId.current)
            rafId.current = requestAnimationFrame(check)
        }

        window.addEventListener('scroll', onScroll, { passive: true })
        check()
        return () => {
            window.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(rafId.current)
        }
    }, [])

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 80, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 border-t-2 border-n-1 bg-white px-4 py-3 md:hidden"
                >
                    {migrationOn ? (
                        // this bar is md:hidden so the visitor is on a phone —
                        // deep-link their store during the migration window
                        <a
                            href={STORE_URL[store]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pointer-events-auto block"
                            onClick={() => trackStoreClick(store, MIGRATION_SURFACES.LANDING_HERO)}
                        >
                            <Button variant="purple" shadowSize="4" className="w-full py-3 text-base font-extrabold">
                                DOWNLOAD NOW
                            </Button>
                        </a>
                    ) : (
                        <Link href="/setup" className="pointer-events-auto block">
                            <Button variant="purple" shadowSize="4" className="w-full py-3 text-base font-extrabold">
                                SIGN UP NOW
                            </Button>
                        </Link>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
