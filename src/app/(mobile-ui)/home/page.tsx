'use client'

import { Button, Card } from '@/components/0_Bruddle'
import { ArrowIcon } from '@/components/0_Bruddle'
import Image from 'next/image'
import React from 'react'
import PeanutWalletIcon from '@/assets/icons/peanut-wallet.png'
import Icon from '@/components/Global/Icon'
import { motion, useAnimation } from 'framer-motion'
import { useRef, useEffect } from 'react'
import useAvatar from '@/hooks/useAvatar'
import classNames from 'classnames'
import { HomeLink } from '@/components/Home/HomeLink'
import { useWallet } from '@/context/walletContext'
import Link from 'next/link'
import { shortenAddress } from '@/utils'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'

const cardWidth = 300
const cardMargin = 16

const Home = () => {
    const controls = useAnimation()
    const { handleLogin, isLoggingIn } = useZeroDev()

    const carouselRef = useRef<HTMLDivElement>(null)

    const { wallets, selectedWallet, setSelectedWallet } = useWallet()

    const { uri: avatarURI } = useAvatar(selectedWallet ? selectedWallet.address : 'i am sad bc i dont have peanut')


    const rawIndex = wallets.findIndex(wallet => wallet.address === selectedWallet?.address);
    const selectedWalletIndex = rawIndex === -1 ? 0 : rawIndex
    const hasWallets = wallets.length > 0
    const isConnectWallet = selectedWallet?.connected;

    console.log({ selectedWallet, isConnectWallet })

    useEffect(() => {
        controls.start({
            x: -(selectedWalletIndex * (cardWidth + cardMargin)),
            transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
    }, [selectedWalletIndex, controls])

    const handleCardClick = (index: number) => {
        setSelectedWallet(wallets[index])
    }

    return (
        <div className="flex h-full w-full flex-row justify-center">
            <div className="flex w-[100%] flex-col gap-4 sm:w-[90%] md:w-[70%] lg:w-[50%]">
                <div className="relative" style={{ height: '250px' }}>
                    <div className="w-full flex flex-row justify-between">
                        <div className='flex flex-col'>
                            <div className="relative mb-2.5 h-21 w-21 self-center">
                                <img className="rounded-full object-cover" src={avatarURI} alt="Avatar" />
                            </div>
                            <div className="text-h4">{selectedWallet?.handle}</div>
                            <div className="text-sm">{shortenAddress(selectedWallet?.address)}</div>
                        </div>
                        {hasWallets && <div>
                            <Button
                                loading={isLoggingIn}
                                disabled={isLoggingIn}
                                shadowSize={!isConnectWallet ? "4" : undefined}
                                variant={isConnectWallet ? "green" : 'purple'}
                                onClick={() => {
                                    if (!selectedWallet?.handle) return
                                    handleLogin(selectedWallet?.handle)
                                }}
                            >
                                {isConnectWallet ? 'Connected' : 'Sign In'}
                            </Button>
                        </div>}
                    </div>
                </div>
                <div
                    className="relative overflow-hidden sm:overflow-visible"
                    style={{ height: '250px', marginRight: -16, marginLeft: -16, padding: 16 }}
                >
                    <motion.div
                        ref={carouselRef}
                        className="absolute flex"
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
                        {wallets.length ? wallets.map((wallet, index) => {
                            const selected = selectedWalletIndex === index
                            const selectedIsConnected = wallet.connected
                            return (
                                <motion.div
                                    key={index}
                                    className={classNames('mr-4', {
                                        'opacity-40': !selected,
                                    })}
                                    onClick={() => handleCardClick(index)}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                >
                                    <Card
                                        className={classNames("flex flex-col gap-4 rounded-md text-white hover:cursor-pointer", {
                                            "bg-green-1": selectedIsConnected,
                                            "bg-purple-1": !selectedIsConnected,
                                        })}
                                        style={{ width: `${cardWidth}px` }}
                                        shadowSize="6"
                                    >
                                        <Card.Content className="flex flex-col gap-2">
                                            <Image src={PeanutWalletIcon} alt="" />
                                            <p className="text-4xl font-black sm:text-5xl">{ }</p>
                                            <div className="flex flex-col">
                                                <p>peanut.me/</p>
                                                <p className="font-bold">{wallet.handle}</p>
                                            </div>
                                        </Card.Content>
                                    </Card>
                                </motion.div>
                            )
                        }) : <Card
                            className={classNames("flex flex-col gap-4 rounded-md hover:cursor-pointer bg-purple-1/30", {
                            })}
                            style={{ width: `${cardWidth}px`, height: '170px' }}
                            shadowSize="6"
                        >
                            <Link href="/setup" className="h-full">
                                <Card.Content className="flex flex-col h-full justify-center items-center  gap-2">
                                    <div className="flex h-full flex-row items-center justify-start gap-2">
                                        <Icon name="plus-circle" className="h-8 w-8" />
                                        <p className="text-lg font-bold">Create a peanut wallet</p>
                                    </div>
                                </Card.Content>
                            </Link>
                        </Card>}
                    </motion.div>
                </div>
                {hasWallets && <div className=''>
                    <Card
                        className="flex flex-col gap-4 w-full rounded-md hover:cursor-pointer"
                        shadowSize="4"
                    >
                        <Link href="/setup" className="h-full">
                            <Card.Content className="flex h-full flex-row items-center justify-start gap-2">
                                <Icon name="plus-circle" className="h-8 w-8" />
                                <p className="text-lg font-bold">Create a peanut wallet</p>
                            </Card.Content>
                        </Link>
                    </Card>
                </div>}
                <div className="flex w-full flex-row items-center justify-center gap-4 sm:justify-between sm:gap-8">
                    <motion.div
                        className="flex flex-col items-center gap-2"
                        whileTap={{ scale: 0.95 }}
                    >
                        <HomeLink href={'/send'}>
                            <ArrowIcon />
                        </HomeLink>
                        <p className="text-base">Send</p>
                    </motion.div>
                    <motion.div
                        className="flex flex-col items-center gap-2"
                        whileTap={{ scale: 0.95 }}
                    >
                        <HomeLink href={'/request/create'}>
                            <ArrowIcon className="rotate-180" />
                        </HomeLink>
                        <p>Recieve</p>
                    </motion.div>
                    <motion.div
                        className="flex flex-col items-center gap-2"
                        whileTap={{ scale: 0.95 }}
                    >
                        <HomeLink href={'/cashout'}>
                            <Icon name="bank" className="h-10 w-10" />
                        </HomeLink>
                        <p>Cashout</p>
                    </motion.div>
                </div>
            </div>
        </div >
    )
}

export default Home
