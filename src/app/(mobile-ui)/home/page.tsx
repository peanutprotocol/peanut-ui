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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const cardWidth = 300
const cardMargin = 16

interface DragEvent {
    offset: { x: number; y: number }
    velocity: { x: number; y: number }
}

export default function Home() {
    const dispatch = useAppDispatch()
    const controls = useAnimation()
    const router = useRouter()
    const carouselRef = useRef<HTMLDivElement>(null)
    const focusedIndexRef = useRef(0)
    const { connectWallet } = useWalletConnection()

    const [isBalanceHidden, setIsBalanceHidden] = useState(() => getUserPreferences()?.balanceHidden ?? false)

    const { username } = useAuth()
    const { selectedWallet, wallets, isWalletConnected, isFetchingWallets } = useWallet()
    const { focusedWallet: focusedWalletId } = useWalletStore()

    const hasWallets = useMemo(() => wallets.length > 0, [wallets])
    const totalCards = useMemo(() => (hasWallets ? wallets.length + 1 : 1), [hasWallets, wallets])

    const setFocusedIndex = useCallback(
        (index: number) => {
            focusedIndexRef.current = index
            controls.start({
                x: -(index * (cardWidth + cardMargin)),
                transition: { type: 'spring', stiffness: 300, damping: 30 },
            })
        },
        [controls]
    )

    useEffect(() => {
        const index = wallets.findIndex((wallet) => wallet.id === selectedWallet?.id)
        if (index !== -1) {
            setFocusedIndex(index)
            dispatch(walletActions.setFocusedWallet(wallets[index]))
        }
    }, [selectedWallet, wallets, setFocusedIndex, dispatch])

    const handleToggleBalanceVisibility = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        setIsBalanceHidden((prev: boolean) => {
            const newValue = !prev
            updateUserPreferences({ balanceHidden: newValue })
            return newValue
        })
    }, [])

    const handleCardClick = useCallback(
        (index: number) => {
            if (index < wallets.length) {
                const wallet = wallets[index]
                if (focusedIndexRef.current !== index) {
                    setFocusedIndex(index)
                    dispatch(walletActions.setFocusedWallet(wallet))
                    if (
                        // check wallet type and ID
                        (wallet.id.startsWith('peanut-wallet') &&
                            wallet.walletProviderType === WalletProviderType.PEANUT) ||
                        (wallet.id === 'pinta-wallet' && wallet.walletProviderType === WalletProviderType.REWARDS) ||
                        (wallet.walletProviderType === WalletProviderType.BYOW && isWalletConnected(wallet))
                    ) {
                        dispatch(walletActions.setSelectedWalletId(wallet.id))
                    }
                } else {
                    router.push('/wallet')
                }
            }
        },
        [dispatch, router, isWalletConnected, setFocusedIndex, wallets]
    )

    const handleDragEnd = useCallback(
        (_e: MouseEvent | TouchEvent, { offset, velocity }: DragEvent) => {
            const swipe = Math.abs(offset.x) * velocity.x
            let targetIndex = focusedIndexRef.current
            if (swipe < -10000) targetIndex = Math.min(targetIndex + 1, totalCards - 1)
            else if (swipe > 10000) targetIndex = Math.max(targetIndex - 1, 0)
            setFocusedIndex(targetIndex)
        },
        [setFocusedIndex, totalCards]
    )

    const isAddWalletFocused = useMemo(
        () => wallets.length === 0 || wallets.length <= focusedIndexRef.current,
        [wallets]
    )

    if (isFetchingWallets) return <PeanutLoading />

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
                        >
                            <motion.div
                                ref={carouselRef}
                                className="absolute flex h-[calc(100%-32px)] px-4"
                                animate={controls}
                                drag="x"
                                dragConstraints={{ left: -((totalCards - 1) * (cardWidth + cardMargin)), right: 0 }}
                                dragElastic={0.2}
                                onDragEnd={handleDragEnd}
                            >
                                {wallets.map((wallet, index) => (
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
                                        isFocused={focusedIndexRef.current === index}
                                    />
                                ))}
                                <WalletCard type="add" onClick={connectWallet} />
                            </motion.div>
                        </div>
                    </div>
                    <div className="px-6 md:pb-6">
                        {!isAddWalletFocused &&
                        focusedWalletId &&
                        wallets.find((w) => w.id === focusedWalletId)?.walletProviderType ===
                            WalletProviderType.REWARDS ? (
                            <DirectSendQr />
                        ) : (
                            <DirectionalActionButtons
                                leftButton={{ title: 'Send', href: '/send' }}
                                rightButton={{ title: 'Receive', href: '/request/create' }}
                            />
                        )}
                    </div>
                </div>
            </div>
            <RewardsModal />
        </div>
    )
}
