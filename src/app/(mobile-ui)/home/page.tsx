'use client'

import { ArrowIcon, Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import WalletHeader from '@/components/Global/WalletHeader'
import { WalletCard } from '@/components/Home/WalletCard'
import ProfileSection from '@/components/Profile/Components/ProfileSection'
import { useAuth } from '@/context/authContext'
import { useWallet, useWalletConnection } from '@/hooks/useWallet'
import { useZeroDev } from '@/hooks/useZeroDev'
import { WalletProviderType } from '@/interfaces'
import { getUserPreferences, updateUserPreferences } from '@/utils'
import classNames from 'classnames'
import { motion, useAnimation } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const cardWidth = 300
const cardMargin = 16

export default function Home() {
    const controls = useAnimation()
    const router = useRouter()
    const carouselRef = useRef<HTMLDivElement>(null)
    const { connectWallet: connectNewWallet } = useWalletConnection()

    const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
        const prefs = getUserPreferences()
        return prefs?.balanceHidden ?? false
    })

    const { addBYOW, username } = useAuth()

    const { selectedWallet, wallets, isPeanutWallet, isConnected, setSelectedWallet, isWalletConnected } = useWallet()

    // Initialize focusedIndex to match selectedWalletIndex
    const rawIndex = wallets.findIndex((wallet) => wallet.address === selectedWallet?.address)
    const selectedWalletIndex = rawIndex === -1 ? 0 : rawIndex
    const [focusedIndex, setFocusedIndex] = useState(selectedWalletIndex)

    // Update focusedIndex when selectedWallet changes
    useEffect(() => {
        const index = wallets.findIndex((wallet) => wallet.address === selectedWallet?.address)
        if (index !== -1) {
            setFocusedIndex(index)
        }
    }, [selectedWallet, wallets])

    const handleAddBYOW = async () => {
        await connectNewWallet()
    }

    const hasWallets = wallets.length > 0
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()
    const totalCards = hasWallets ? wallets.length + 1 : 1

    const handleToggleBalanceVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        setIsBalanceHidden((prev: boolean) => {
            const newValue = !prev
            updateUserPreferences({ balanceHidden: newValue })
            return newValue
        })
    }

    useEffect(() => {
        controls.start({
            x: -(selectedWalletIndex * (cardWidth + cardMargin)),
            transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
    }, [selectedWalletIndex, controls])

    const handleCardClick = (index: number) => {
        if (index < wallets.length) {
            const wallet = wallets[index]

            if (focusedIndex !== index) {
                setFocusedIndex(index)
                controls.start({
                    x: -(index * (cardWidth + cardMargin)),
                    transition: { type: 'spring', stiffness: 300, damping: 30 },
                })

                if (wallet.walletProviderType === WalletProviderType.PEANUT || isWalletConnected(wallet)) {
                    setSelectedWallet(wallet)
                }
                return
            }

            if (focusedIndex === index) {
                router.push('/wallet')
            }
        }
    }

    const handleDragEnd = (_e: any, { offset, velocity }: any) => {
        const swipe = Math.abs(offset.x) * velocity.x
        let targetIndex = focusedIndex

        if (swipe < -10000) {
            targetIndex = Math.min(focusedIndex + 1, totalCards - 1)
        } else if (swipe > 10000) {
            targetIndex = Math.max(focusedIndex - 1, 0)
        }

        setFocusedIndex(targetIndex)

        if (targetIndex < wallets.length) {
            const targetWallet = wallets[targetIndex]
            if (targetWallet.walletProviderType === WalletProviderType.PEANUT || isWalletConnected(targetWallet)) {
                setSelectedWallet(targetWallet)
            }
        }

        controls.start({
            x: -(targetIndex * (cardWidth + cardMargin)),
            transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
    }

    return (
        <div className="w-full">
            <div className="flex w-full flex-row justify-center overflow-hidden p-6">
                <div className="flex w-[100%] flex-col gap-4 sm:w-[90%] md:w-[70%] lg:w-[50%]">
                    <div className="flex items-center justify-between">
                        <WalletHeader />
                        {/* todo: temp sign in button, remove it once auth state is fixed */}
                        <div>
                            {hasWallets && (isPeanutWallet || isConnected) && (
                                <div>
                                    <Button
                                        loading={isLoggingIn}
                                        disabled={isLoggingIn}
                                        shadowSize={!isConnected ? '4' : undefined}
                                        variant={isConnected ? 'green' : 'purple'}
                                        size="small"
                                        onClick={() => {
                                            if (isConnected) return
                                            handleLogin().catch((_error) => {
                                                toast.error('Error logging in')
                                            })
                                        }}
                                    >
                                        {isConnected ? 'Connected' : 'Sign In'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    <ProfileSection />
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
                                onDragEnd={handleDragEnd}
                            >
                                {!!wallets.length &&
                                    wallets.map((wallet, index) => (
                                        <WalletCard
                                            key={wallet.address}
                                            type="wallet"
                                            wallet={wallet}
                                            username={username ?? ''}
                                            selected={selectedWalletIndex === index}
                                            // isConnected={isWalletConnected(wallet)}
                                            // isUsable={isWalletUsable(wallet)}
                                            onClick={() => handleCardClick(index)}
                                            index={index}
                                            isBalanceHidden={isBalanceHidden}
                                            onToggleBalanceVisibility={handleToggleBalanceVisibility}
                                            isFocused={focusedIndex === index}
                                        />
                                    ))}

                                <WalletCard type="add" onClick={handleAddBYOW} />
                            </motion.div>
                        ) : (
                            <div className="flex h-full w-full flex-grow flex-col justify-center">
                                <WalletCard type="add" onClick={handleAddBYOW} />
                            </div>
                        )}
                    </div>

                    <div className="flex w-full flex-grow flex-row items-center justify-center gap-5 sm:justify-evenly md:mx-auto md:w-fit">
                        <Link href={'/send'}>
                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="flex w-38 items-center gap-2 rounded-full transition-all ease-in-out active:scale-95"
                            >
                                <ArrowIcon />
                                <p className="text-base">Send</p>
                            </Button>
                        </Link>
                        <Link href={'/request/create'}>
                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="flex w-38 items-center gap-2 rounded-full transition-all ease-in-out active:scale-95"
                            >
                                <ArrowIcon className="rotate-180" />
                                <p className="text-base">Receive</p>
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
