'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/0_Bruddle/Button'

export function StickyMobileCTA() {
    const [visible, setVisible] = useState(false)
    const rafId = useRef(0)
    const lastVisible = useRef(false)

    useEffect(() => {
        const check = () => {
            const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 100
            const next = window.scrollY >= 300 && !atBottom

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
                    <a href="/setup" className="pointer-events-auto block">
                        <Button variant="purple" shadowSize="4" className="w-full py-3 text-base font-extrabold">
                            SIGN UP NOW
                        </Button>
                    </a>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
