'use client'
import { motion } from 'framer-motion'
import { Button } from '@/components/0_Bruddle/Button'
import { Star } from '@/assets'
import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import PioneerCard3D from './PioneerCard3D'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'

const CardPioneers = () => {
    const { user } = useAuth()
    const router = useRouter()
    const [screenWidth, setScreenWidth] = useState(1200)

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth)
        handleResize() // Set actual width on mount
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const isMobile = screenWidth < 768

    const handleCTA = () => {
        if (user) {
            router.push('/card')
        } else {
            router.push('/setup?redirect_uri=/card')
        }
    }

    return (
        <section id="card-pioneers" className="relative overflow-hidden bg-secondary-1 py-16 text-n-1 md:py-24">
            {!isMobile && <Stars />}
            <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 md:flex-row md:gap-12 md:px-8 lg:gap-20">
                {/* Card on left */}
                <div className="flex w-full justify-center md:w-1/2">
                    <PioneerCard3D />
                </div>

                {/* Copy on right */}
                <div className="w-full text-center md:w-1/2 md:text-left">
                    <h1 className="font-roboto-flex-extrabold text-[2.25rem] font-extraBlack leading-tight md:text-5xl lg:text-6xl">
                        PAY EVERYWHERE.
                    </h1>

                    <p className="font-roboto-flex mt-4 text-lg md:text-xl">
                        Get the Peanut Card and pay anywhere in the world.
                    </p>

                    <ul className="font-roboto-flex mt-6 space-y-3 text-base md:text-lg">
                        <li className="flex items-center justify-center gap-3 md:justify-start">
                            <Icon name="check-circle" className="h-6 w-6 flex-shrink-0 text-n-1" />
                            Best rates - no hidden fees
                        </li>
                        <li className="flex items-center justify-center gap-3 md:justify-start">
                            <Icon name="check-circle" className="h-6 w-6 flex-shrink-0 text-n-1" />
                            Earn forever for every invite
                        </li>
                        <li className="flex items-center justify-center gap-3 md:justify-start">
                            <Icon name="check-circle" className="h-6 w-6 flex-shrink-0 text-n-1" />
                            Self-custodial - your funds, your control
                        </li>
                    </ul>

                    <div className="mt-8 flex flex-col items-center gap-4">
                        <Button
                            shadowSize="4"
                            onClick={handleCTA}
                            className="w-full px-10 py-4 text-lg font-extrabold md:w-auto"
                        >
                            GET MY CARD
                        </Button>
                        <a
                            href="/lp/card"
                            className="font-roboto-flex text-sm font-medium text-n-1 underline underline-offset-2 hover:no-underline"
                        >
                            Learn more about Card Pioneers →
                        </a>
                    </div>
                </div>
            </div>
        </section>
    )
}

// Animated stars - matches Manteca.tsx pattern
const Stars = () => (
    <>
        <motion.img
            src={Star.src}
            alt="Star"
            width={50}
            height={50}
            className="absolute left-12 top-10"
            initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: 22 }}
            whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 22 }}
            transition={{ type: 'spring', damping: 5, delay: 0.2 }}
        />
        <motion.img
            src={Star.src}
            alt="Star"
            width={40}
            height={40}
            className="absolute bottom-16 right-16"
            initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: -15 }}
            whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: -15 }}
            transition={{ type: 'spring', damping: 5, delay: 0.4 }}
        />
        <motion.img
            src={Star.src}
            alt="Star"
            width={35}
            height={35}
            className="absolute right-1/3 top-8"
            initial={{ opacity: 0, translateY: 20, rotate: 10 }}
            whileInView={{ opacity: 1, translateY: 0, rotate: 10 }}
            transition={{ type: 'spring', damping: 5, delay: 0.6 }}
        />
    </>
)

export { CardPioneers }
