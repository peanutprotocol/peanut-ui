'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/0_Bruddle/Button'
import type { LandingStrings } from './landingStrings'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useTranslations } from 'next-intl'
import { onStoreAnchorClick, storeAnchorHref } from '@/utils/migration.utils'

export function StickyMobileCTA({ strings }: { strings: LandingStrings }) {
    const [visible, setVisible] = useState(false)
    const rafId = useRef(0)
    const lastVisible = useRef(false)
    const migrationOn = useMigrationFlag()
    const tMigration = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const store = deviceType === DeviceType.ANDROID ? 'android' : 'ios'
    // memoized: this bar re-renders through scroll-driven animation frames,
    // and the android href builds the hand-off payload (cookie reads)
    const storeHref = useMemo(() => storeAnchorHref(store), [store])

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
                    className="pointer-events-none fixed right-0 bottom-0 left-0 z-50 border-t-2 border-n-1 bg-white px-4 py-3 md:hidden"
                >
                    {migrationOn ? (
                        // this bar is md:hidden so the visitor is on a phone —
                        // deep-link their store during the migration window
                        <a
                            href={storeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pointer-events-auto block"
                            onClick={() => onStoreAnchorClick(store, MIGRATION_SURFACES.LANDING_HERO)}
                        >
                            <Button
                                variant="purple"
                                shadowSize="4"
                                icon={store === 'ios' ? 'apple-logo' : 'google-play'}
                                className="w-full py-3 text-base font-extrabold uppercase"
                            >
                                {tMigration('downloadNow')}
                            </Button>
                        </a>
                    ) : (
                        <Link href="/setup" className="pointer-events-auto block">
                            <Button variant="purple" shadowSize="4" className="w-full py-3 text-base font-extrabold">
                                {strings.signUpNow}
                            </Button>
                        </Link>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
