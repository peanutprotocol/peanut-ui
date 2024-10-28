'use client'

import { Card } from '@/components/0_Bruddle'
import { ArrowIcon } from '@/components/0_Bruddle'
import Image from 'next/image'
import React from 'react'
import PeanutWalletIcon from '@/assets/icons/peanut-wallet.png'
import Icon from '@/components/Global/Icon'
import { motion, useAnimation } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import useAvatar from '@/hooks/useAvatar'
import classNames from 'classnames'
import { HomeLink } from '@/components/Home/HomeLink'
import { useWallet } from '@/context/walletContext'
import { IWallet, WalletProviderType } from '@/interfaces'
import { useAuth } from '@/context/authContext'
import { useWeb3Modal } from '@web3modal/wagmi/react'

import * as interfaces from '@/interfaces'

const Home = () => {
    const [selectedWalletIndex, setSelectedWalletIndex] = useState(0)
    // TODO: should error strings be moved to the walletContext?
    const [walletErrorStrings, setWalletErrorStrings] = useState<(string | null)[]>([])
    const [connectProviderButtonShown, setConnectProviderButtonShown] = useState<boolean>(false)

    const carouselRef = useRef<HTMLDivElement>(null)
    const controls = useAnimation()

    const { wallets, areWalletsFetchedAndSetup, checkActivateWallet } = useWallet()
    const { user } = useAuth()

    const { open } = useWeb3Modal()

    // const wallets = [
    //     { amount: '$40.00', username: 'kkonrad', email: 'kkonrad@peanut.to' },
    //     { amount: '$55.00', username: 'alice123', email: 'alice123@peanut.to' },
    //     { amount: '$30.00', username: 'bob456', email: 'bob456@peanut.to' },
    //     { amount: '$70.00', username: 'charlie789', email: 'charlie789@peanut.to' },
    //     { amount: '$25.00', username: 'david101', email: 'david101@peanut.to' },
    // ]

    const cardWidth = 300
    const cardMargin = 16
    const { uri: avatarURI } = useAvatar(wallets[selectedWalletIndex] ? wallets[selectedWalletIndex].address : 'i am sad bc i dont have peanut')

    const { uri: sadAvatarURI} = useAvatar('i am sad bc i dont have peanut')

    useEffect(() => {
        controls.start({
            x: -(selectedWalletIndex * (cardWidth + cardMargin)),
            transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
    }, [selectedWalletIndex, controls])

    // sets errorString size
    useEffect(() => {
        if (wallets) {
            cleanErrors()
        } else{
            setWalletErrorStrings([])
        }
    }, [wallets])

    const handleCardClick = async (index: number, wallet: IWallet) => {
        try {
            await checkActivateWallet(wallet)
            setSelectedWalletIndex(index)
            cleanErrors()
        } catch (error) {
            if (error instanceof interfaces.WalletError) {
                // TODO: handle that it throws error
                walletErrorStrings[index] = error.message
                setWalletErrorStrings([...walletErrorStrings])

                // TODO: differentiate between kinds of errors
                setConnectProviderButtonShown(true)
            } else {
                throw error
            }
        }
    }

    const cleanErrors = async () => {
        setWalletErrorStrings(new Array(wallets.length).fill(null))
    }

    const handleConnectCorrectBYOWToProvider = async (index: number, wallet: IWallet) => {
        await open()
        handleCardClick(index, wallet)
    }

    const handleAddBYOW = () => {}


    return (
        <div className="flex h-full w-full flex-row justify-center overflow-hidden">
            <div className="flex w-[100%] flex-col gap-4 sm:w-[90%] md:w-[70%] lg:w-[50%]">
                {/* Logged in (always an available wallet) */}
                {areWalletsFetchedAndSetup && (
                    <div className="w-full">
                        <div className="relative mb-2.5 h-21 w-21 self-center">
                            <img className="rounded-full object-cover" src={avatarURI} alt="Avatar" />
                        </div>
                        <div className="text-h4">{wallets[selectedWalletIndex].address}</div>
                        <div className="text-sm">{wallets[selectedWalletIndex].protocolType}</div>
                    </div>
                )}

                <div className="relative" style={{ height: '250px' }}>
                    <motion.div
                        ref={carouselRef}
                        className="absolute left-0 flex"
                        animate={controls}
                        drag="x"
                        dragConstraints={{ left: -((wallets.length - 1) * (cardWidth + cardMargin)), right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(e, { offset, velocity }) => {
                            const swipe = Math.abs(offset.x) * velocity.x
                            if (swipe < -10000) {
                                const nextIndex = Math.min(selectedWalletIndex + 1, wallets.length - 1)
                                setSelectedWalletIndex(nextIndex)
                            } else if (swipe > 10000) {
                                const prevIndex = Math.max(selectedWalletIndex - 1, 0)
                                setSelectedWalletIndex(prevIndex)
                            } else {
                                controls.start({
                                    x: -(selectedWalletIndex * (cardWidth + cardMargin)),
                                    transition: { type: 'spring', stiffness: 300, damping: 30 },
                                })
                            }
                        }}
                    >
                        {areWalletsFetchedAndSetup && (
                            <>
                                {wallets.map((wallet: IWallet, index) => {
                                    const selected = selectedWalletIndex === index
                                    return (
                                        <motion.div
                                            key={index}
                                            className={classNames('mr-4', {
                                                'opacity-40': !selected,
                                            })}
                                            onClick={() => {
                                                handleCardClick(
                                                    index,
                                                    wallet
                                                )
                                            }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                        >
                                            <Card
                                                className="flex flex-col gap-4 rounded-md bg-purple-1 text-white hover:cursor-pointer"
                                                style={{ width: `${cardWidth}px` }}
                                                shadowSize="6"
                                            >
                                                {wallet.walletProviderType == WalletProviderType.PEANUT && (
                                                    <Card.Content className="flex flex-col gap-2">
                                                        <Image src={PeanutWalletIcon} alt="" />
                                                        {/* <p className="text-4xl font-black sm:text-5xl">{wallet.amount}</p> */}
                                                        <div className="flex flex-col">
                                                            <p>peanut.me/</p>
                                                            <p className="font-bold">{user?.user.username}</p>
                                                        </div>
                                                    </Card.Content>
                                                )}
                                                {wallet.walletProviderType == WalletProviderType.BYOW && (
                                                    <Card.Content className="flex flex-col gap-2">
                                                        <img className="rounded-full object-cover" src={useAvatar(wallet.address).uri} alt="Avatar" />
                                                        {/* <p className="text-4xl font-black sm:text-5xl">{wallet.amount}</p> */}
                                                        <div className="flex flex-col">
                                                            <p className="font-bold">{wallet.address}</p>
                                                        </div>
                                                        {/* TODO: make errors look nicer */}
                                                        {walletErrorStrings[index] && (
                                                            <div>
                                                                {walletErrorStrings[index]}
                                                                {connectProviderButtonShown && (
                                                                    <div
                                                                        onClick={(event) => {
                                                                            event.stopPropagation()
                                                                            handleConnectCorrectBYOWToProvider(index, wallet)
                                                                        }}
                                                                    >
                                                                        this is the provider button
                                                                    </div>
                                                                )}

                                                            </div>
                                                        )}
                                                        
                                                    </Card.Content>
                                                )}

                                            </Card>
                                        </motion.div>
                                    )
                                })}
                            </>

                        )}

                    <motion.div
                            onClick={() => handleAddBYOW()}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        >
                            <Card
                                className="flex flex-col gap-4 rounded-md bg-purple-1 text-white hover:cursor-pointer"
                                style={{ width: `${cardWidth}px` }}
                                shadowSize="6"
                            >
                                <Card.Content className="flex flex-col gap-2">
                                    <Image src={PeanutWalletIcon} alt="" />
                                    <p className="text-4xl font-black sm:text-5xl">Add your own wallet</p>
                                    <div className="flex flex-col">
                                        <p className="font-bold">Connect your wallets to your Peanut account</p>
                                    </div>
                                </Card.Content>
                            </Card>
                        </motion.div>

                    </motion.div>
                </div>
                <div className="flex w-full flex-row items-center justify-center gap-4 sm:justify-between sm:gap-8">
                    <div className="flex flex-col items-center gap-2">
                        <HomeLink href={'/send'}>
                            <ArrowIcon />
                        </HomeLink>
                        <p className="text-base">Send</p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <HomeLink href={'/request/create'}>
                            <ArrowIcon className="rotate-180" />
                        </HomeLink>
                        <p>Receive</p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <HomeLink href={'/cashout'}>
                            <Icon name="bank" className="h-10 w-10" />
                        </HomeLink>
                        <p>Cashout</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Home
