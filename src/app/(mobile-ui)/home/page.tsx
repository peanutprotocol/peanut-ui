'use client'

import { Card } from '@/components/0_Bruddle'
import { ArrowIcon } from '@/components/0_Bruddle'
import Image from 'next/image'
import React from 'react'
import PeanutWalletIcon from '@/assets/icons/peanut-wallet.png'
import Icon from '@/components/Global/Icon'
import { motion, useAnimation } from 'framer-motion'
import { useRef, useEffect } from 'react'
import classNames from 'classnames'
import { HomeLink } from '@/components/Home/HomeLink'
import { useWallet } from '@/context/walletContext'
import Link from 'next/link'
import { shortenAddressLong } from '@/utils'
import PointsBanner from '@/components/Home/PointsBanner'
import { useRouter } from 'next/navigation'
import HomeHeader from '@/components/Home/HomeHeader'
import { useAuth } from '@/context/authContext'

const cardWidth = 300
const cardMargin = 16

const Home = () => {
    const controls = useAnimation()
    const router = useRouter()
    const carouselRef = useRef<HTMLDivElement>(null)
    const { wallets, selectedWallet, setSelectedWallet } = useWallet()
    const rawIndex = wallets.findIndex((wallet) => wallet.address === selectedWallet?.address)
    const selectedWalletIndex = rawIndex === -1 ? 0 : rawIndex
    const hasWallets = wallets.length > 0
    const { username } = useAuth()

    useEffect(() => {
        controls.start({
            x: -(selectedWalletIndex * (cardWidth + cardMargin)),
            transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
    }, [selectedWalletIndex, controls])

    const handleCardClick = (index: number) => {
        if (selectedWalletIndex === index) {
            router.push('/wallet')
        } else {
            setSelectedWallet(wallets[index])
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
                        {wallets.length ? (
                            <motion.div
                                ref={carouselRef}
                                className="absolute flex h-[calc(100%-32px)]"
                                animate={controls}
                                drag="x"
                                dragConstraints={{ left: -((wallets.length - 1) * (cardWidth + cardMargin)), right: 0 }}
                                dragElastic={0.2}
                                onDragEnd={(e, { offset, velocity }) => {
                                    const swipe = Math.abs(offset.x) * velocity.x
                                    if (swipe < -10000) {
                                        const nextIndex = Math.min(selectedWalletIndex + 1, wallets.length - 1)
                                        setSelectedWallet(wallets[nextIndex])
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
                                {wallets.map((wallet, index) => {
                                    const selected = selectedWalletIndex === index
                                    const selectedIsConnected = wallet.connected
                                    return (
                                        <motion.div
                                            key={index}
                                            className={classNames('mr-4 h-full', {
                                                'opacity-40': !selected,
                                            })}
                                            onClick={() => handleCardClick(index)}
                                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                        >
                                            <Card
                                                className={classNames(
                                                    'flex h-full w-[300px] flex-col gap-4 rounded-md text-white hover:cursor-pointer',
                                                    {
                                                        'bg-green-1': selectedIsConnected,
                                                        'bg-purple-1': !selectedIsConnected,
                                                    }
                                                )}
                                                shadowSize="6"
                                            >
                                                <Card.Content className="flex h-full flex-col justify-between gap-2">
                                                    <div className="flex flex-row items-center gap-4">
                                                        <Image src={PeanutWalletIcon} alt="" />
                                                        <p className="text-md">
                                                            peanut.me/<span className="font-bold">{username}</span>
                                                        </p>
                                                    </div>
                                                    <p className="text-4xl font-black sm:text-5xl">$ 0.00</p>
                                                    <div>
                                                        <div className="flex flex-col">
                                                            <p className="text-xl font-black sm:text-2xl">
                                                                {shortenAddressLong(wallet.address)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Card.Content>
                                            </Card>
                                        </motion.div>
                                    )
                                })}
                            </motion.div>
                        ) : (
                            <div className="flex h-full w-full flex-grow flex-col justify-center">
                                <Card
                                    className={classNames(
                                        'flex w-full flex-col gap-4 rounded-md text-black hover:cursor-pointer'
                                    )}
                                    shadowSize="6"
                                >
                                    <Link href="/setup" className="h-full">
                                        <Card.Content className="flex h-full flex-col items-center justify-center gap-8">
                                            <p className="text-2xl font-bold">Get Started !</p>
                                            <div className="flex flex-row items-center justify-start gap-4">
                                                <Icon name="plus-circle" className="h-8 w-8" />
                                                <p className="text-lg">Create a peanut wallet</p>
                                            </div>
                                        </Card.Content>
                                    </Link>
                                </Card>
                            </div>
                        )}
                    </div>
                    {hasWallets && (
                        <div className="">
                            <Card className="flex w-full flex-col gap-4 rounded-md hover:cursor-pointer" shadowSize="4">
                                <Link href="/setup" className="h-full">
                                    <Card.Content className="flex h-full flex-row items-center justify-start gap-2">
                                        <Icon name="plus-circle" className="h-8 w-8" />
                                        <p className="text-lg font-bold">Create a peanut wallet</p>
                                    </Card.Content>
                                </Link>
                            </Card>
                        </div>
                    )}
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

export default Home
