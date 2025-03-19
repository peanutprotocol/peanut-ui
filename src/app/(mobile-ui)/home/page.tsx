'use client'

import { PEANUT_LOGO_BLACK } from '@/assets'
import DirectionalActionButtons from '@/components/Global/DirectionalActionButtons'
import DirectSendQr from '@/components/Global/DirectSendQR'
import LogoutButton from '@/components/Global/LogoutButton'
import PeanutLoading from '@/components/Global/PeanutLoading'
import RewardsModal from '@/components/Global/RewardsModal'
import { WalletCard } from '@/components/Home/WalletCard'
import ProfileSection from '@/components/Profile/Components/ProfileSection'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useWalletConnection } from '@/hooks/wallet/useWalletConnection'
import { WalletProviderType } from '@/interfaces'
import { useAppDispatch, useWalletStore } from '@/redux/hooks'
import { walletActions } from '@/redux/slices/wallet-slice'
import { getUserPreferences, updateUserPreferences } from '@/utils'
import classNames from 'classnames'
import { motion, useAnimation } from 'framer-motion'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useMemo } from 'react'

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

    const { selectedWallet, wallets, isWalletConnected, isFetchingWallets } = useWallet()
    const { focusedWallet: focusedWalletId } = useWalletStore()

    const [focusedIndex, setFocusedIndex] = useState(0)

    // update focusedIndex and focused wallet when selectedWallet changes
    useEffect(() => {
        const index = wallets.findIndex((wallet) => wallet.id === selectedWallet?.id)
        if (index !== -1) {
            setFocusedIndex(index)
            dispatch(walletActions.setFocusedWallet(wallets[index]))
        }
    }, [selectedWallet, wallets])

    const hasWallets = useMemo(() => wallets.length > 0, [wallets])
    const totalCards = useMemo(() => (hasWallets ? wallets.length + 1 : 1), [hasWallets, wallets])

    const handleToggleBalanceVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        setIsBalanceHidden((prev: boolean) => {
            const newValue = !prev
            updateUserPreferences({ balanceHidden: newValue })
            return newValue
        })
    }

    useEffect(() => {
        if (!hasWallets || isFetchingWallets) return
        controls.start({
            x: -(focusedIndex * (cardWidth + cardMargin)),
            transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
    }, [focusedIndex, controls, hasWallets, isFetchingWallets])

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

                // check wallet type and ID
                const isValidPeanutWallet =
                    wallet.id.startsWith('peanut-wallet') && wallet.walletProviderType === WalletProviderType.PEANUT

                const isValidRewardsWallet =
                    wallet.id === 'pinta-wallet' && wallet.walletProviderType === WalletProviderType.REWARDS

                const isValidExternalWallet =
                    wallet.walletProviderType === WalletProviderType.BYOW && isWalletConnected(wallet)

                if (isValidPeanutWallet || isValidRewardsWallet || isValidExternalWallet) {
                    dispatch(walletActions.setSelectedWalletId(wallet.id))
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
            dispatch(walletActions.setFocusedWallet(targetWallet))

            // check wallet type and ID
            const isValidPeanutWallet =
                targetWallet.id.startsWith('peanut-wallet') &&
                targetWallet.walletProviderType === WalletProviderType.PEANUT
            const isValidRewardsWallet =
                targetWallet.id === 'pinta-wallet' && targetWallet.walletProviderType === WalletProviderType.REWARDS
            const isValidExternalWallet =
                targetWallet.walletProviderType === WalletProviderType.BYOW && isWalletConnected(targetWallet)

            if (isValidPeanutWallet || isValidRewardsWallet || isValidExternalWallet) {
                dispatch(walletActions.setSelectedWalletId(targetWallet.id))
            }
        }

        controls.start({
            x: -(targetIndex * (cardWidth + cardMargin)),
            transition: { type: 'spring', stiffness: 300, damping: 30 },
        })
    }

    const isAddWalletFocused = useMemo<boolean>(() => {
        if ((wallets?.length ?? 0) === 0) return true
        return wallets.length <= focusedIndex
    }, [focusedIndex, wallets?.length])

    if (isFetchingWallets) {
        return <PeanutLoading />
    }

    return (
        <div className="h-full w-full">
            <div className="flex h-full w-full flex-row justify-center overflow-hidden py-6 md:py-0">
                <div className="flex w-[100%] flex-col gap-4 sm:w-[90%] md:w-[70%] lg:w-[50%]">
                    <div className="space-y-4 px-6">
                        <div className="flex items-center justify-between">
                            <div className="flex w-full items-center justify-between md:hidden">
                                <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" className="w-20" />
                                <LogoutButton />
                            </div>
                        </div>
                        <ProfileSection />
                    </div>
                    <div>
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
                                    className="absolute flex h-[calc(100%-32px)] px-4"
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
                                                key={wallet.id}
                                                type="wallet"
                                                wallet={wallet}
                                                username={username ?? ''}
                                                selected={selectedWallet?.id === wallet.id}
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

                    {isAddWalletFocused ? null : focusedWalletId &&
                      wallets.find((w) => w.id === focusedWalletId)?.walletProviderType ===
                          WalletProviderType.REWARDS ? (
                        <div className="px-6 md:pb-6">
                            <DirectSendQr />
                        </div>
                    ) : (
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
                    )}
                </div>
            </div>
            <RewardsModal />
        </div>
    )
}
