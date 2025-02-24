'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import DirectionalActionButtons from '@/components/Global/DirectionalActionButtons'
import LogoutButton from '@/components/Global/LogoutButton'
import { WalletCard } from '@/components/Home/WalletCard'
import ProfileSection from '@/components/Profile/Components/ProfileSection'
import { useAuth } from '@/context/authContext'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useWalletConnection } from '@/hooks/wallet/useWalletConnection'
import { WalletProviderType } from '@/interfaces'
import { useAppDispatch } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { getUserPreferences, updateUserPreferences } from '@/utils'
import classNames from 'classnames'
import { motion, useAnimation } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const cardWidth = 300
const cardMargin = 16

export default function Home() {
    const dispatch = useAppDispatch()
    const controls = useAnimation()
    const router = useRouter()
    const carouselRef = useRef<HTMLDivElement>(null)
    const { connectWallet } = useWalletConnection()

    const [isBalanceHidden, setIsBalanceHidden] = useState(() => {
        const prefs = getUserPreferences()
        return prefs?.balanceHidden ?? false
    })

    const { username } = useAuth()

    const { selectedWallet, wallets, isPeanutWallet, isConnected, setSelectedWallet, isWalletConnected } = useWallet()

    // initialize focusedIndex to match selectedWalletIndex
    const rawIndex = wallets.findIndex((wallet) => wallet.address === selectedWallet?.address)
    const selectedWalletIndex = rawIndex === -1 ? 0 : rawIndex
    const [focusedIndex, setFocusedIndex] = useState(selectedWalletIndex)

    // update focusedIndex and focused wallet when selectedWallet changes
    useEffect(() => {
        const index = wallets.findIndex((wallet) => wallet.address === selectedWallet?.address)
        if (index !== -1) {
            setFocusedIndex(index)
            // also update the focused wallet when selected wallet changes
            dispatch(walletActions.setFocusedWallet(wallets[index]))
        }
    }, [selectedWallet, wallets, dispatch])

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
                dispatch(walletActions.setFocusedWallet(wallet))
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
            dispatch(walletActions.setFocusedWallet(wallets[targetIndex]))

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
        <div className="h-full w-full">
            <div className="flex h-full w-full flex-row justify-center overflow-hidden py-6 md:py-0">
                <div className="flex w-[100%] flex-col gap-4 sm:w-[90%] md:w-[70%] lg:w-[50%]">
                    <div className="space-y-4 px-6">
                        <div className="flex items-center justify-between">
                            <div className="flex w-full items-center justify-between md:hidden">
                                <div className="font-knerd-outline text-h5 font-semibold">Peanut</div>
                                <LogoutButton />
                            </div>
                        </div>
                        <ProfileSection />
                    </div>
                    <div className="pl-6">
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
                                                onClick={() => handleCardClick(index)}
                                                index={index}
                                                isBalanceHidden={isBalanceHidden}
                                                onToggleBalanceVisibility={handleToggleBalanceVisibility}
                                                isFocused={focusedIndex === index}
                                            />
                                        ))}

                                    <WalletCard type="add" onClick={connectWallet} />
                                </motion.div>
                            ) : (
                                <div className="flex h-full w-full flex-grow flex-col justify-center">
                                    <WalletCard type="add" onClick={connectWallet} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-6 md:pb-6">
                        <DirectionalActionButtons
                            leftButton={{
                                title: 'Send',
                                href: '/send',
                            }}
                            rightButton={{
                                title: 'Receive',
                                href: '/request/create',
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
