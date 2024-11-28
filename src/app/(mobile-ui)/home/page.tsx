'use client'

import { ArrowIcon } from '@/components/0_Bruddle'
import React from 'react'
import { motion, useAnimation } from 'framer-motion'
import { useRef, useEffect } from 'react'
import classNames from 'classnames'
import { HomeLink } from '@/components/Home/HomeLink'
import { useWallet } from '@/context/walletContext'
import { useAuth } from '@/context/authContext'
import PointsBanner from '@/components/Home/PointsBanner'
import { useRouter } from 'next/navigation'
import HomeHeader from '@/components/Home/HomeHeader'
import { WalletCard } from '@/components/Home/WalletCard'

const cardWidth = 300
const cardMargin = 16

export default function Home() {
    const controls = useAnimation()
    const router = useRouter()
    const carouselRef = useRef<HTMLDivElement>(null)

    const { addBYOW, username } = useAuth()
    const { wallets, selectedWallet, setSelectedWallet } = useWallet()
    const rawIndex = wallets.findIndex((wallet) => wallet.address === selectedWallet?.address)
    const selectedWalletIndex = rawIndex === -1 ? 0 : rawIndex
    const hasWallets = wallets.length > 0

    const totalCards = hasWallets ? wallets.length + 1 : 1

    useEffect(() => {
        controls.start({
            x: -(selectedWalletIndex * (cardWidth + cardMargin)),
            transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
    }, [selectedWalletIndex, controls])

    const handleCardClick = (index: number) => {
        if (index < wallets.length) {
            if (selectedWalletIndex === index) {
                router.push('/wallet')
            } else {
                setSelectedWallet(wallets[index])
            }
        }
    }

    return (
        <div className="w-full">
            <PointsBanner />
            <div className="flex w-full flex-row justify-center overflow-hidden p-4">
                <div className="flex w-[100%] flex-col gap-4 sm:w-[90%] sm:gap-2 md:w-[70%] lg:w-[50%]">
                    <HomeHeader />
                    <div
                        className={classNames('relative h-[200px] p-4 sm:overflow-visible', {
                            'overflow-hidden': wallets.length > 0,
                        })}
                        style={{
                            marginRight: -cardMargin,
                            marginLeft: -cardMargin,
                        }}
                    >
                        {hasWallets ? (
                            <motion.div
                                ref={carouselRef}
                                className="absolute flex h-[calc(100%-32px)]"
                                animate={controls}
                                drag="x"
                                dragConstraints={{
                                    left: -((totalCards - 1) * (cardWidth + cardMargin)),
                                    right: 0,
                                }}
                                dragElastic={0.2}
                                onDragEnd={(_e, { offset, velocity }) => {
                                    const swipe = Math.abs(offset.x) * velocity.x
                                    if (swipe < -10000) {
                                        const nextIndex = Math.min(selectedWalletIndex + 1, totalCards - 1)
                                        if (nextIndex < wallets.length) {
                                            setSelectedWallet(wallets[nextIndex])
                                        }
                                    } else if (swipe > 10000) {
                                        const prevIndex = Math.max(selectedWalletIndex - 1, 0)
                                        setSelectedWallet(wallets[prevIndex])
                                    } else {
                                        controls.start({
                                            x: -(selectedWalletIndex * (cardWidth + cardMargin)),
                                            transition: { type: 'spring', stiffness: 300, damping: 30 },
                                        })
                                    }
                                }}
                            >
                                {wallets.map((wallet, index) => (
                                    <WalletCard
                                        key={wallet.address}
                                        type="wallet"
                                        wallet={wallet}
                                        username={username ?? ''}
                                        selected={selectedWalletIndex === index}
                                        onClick={() => handleCardClick(index)}
                                    />
                                ))}

                                <WalletCard type="add" onClick={addBYOW} />
                            </motion.div>
                        ) : (
                            <div className="flex h-full w-full flex-grow flex-col justify-center">
                                <WalletCard type="add" onClick={addBYOW} />
                            </div>
                        )}
                    </div>

                    <div className="flex w-full flex-grow flex-row items-center justify-center gap-4 sm:justify-evenly sm:gap-8">
                        <motion.div className="flex flex-col items-center gap-2" whileTap={{ scale: 0.95 }}>
                            <HomeLink href={'/send'}>
                                <ArrowIcon />
                            </HomeLink>
                            <p className="text-base">Send</p>
                        </motion.div>
                        <motion.div className="flex flex-col items-center gap-2" whileTap={{ scale: 0.95 }}>
                            <HomeLink href={'/request/create'}>
                                <ArrowIcon className="rotate-180" />
                            </HomeLink>
                            <p>Recieve</p>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    )
}
