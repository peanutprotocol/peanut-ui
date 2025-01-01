'use client'

import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import Modal from '@/components/Global/Modal'
import HomeWaitlist from '@/components/Home/HomeWaitlist'
import { peanutWalletIsInPreview } from '@/constants'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/context/walletContext'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
// import { useAppKit } from '@reown/appkit/react'
import WalletNavigation from '@/components/Global/WalletNavigation'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import classNames from 'classnames'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import '../../styles/globals.bruddle.css'

const publicPathRegex = /^\/(request\/pay|claim)/

const Layout = ({ children }: { children: React.ReactNode }) => {
    const pathName = usePathname()
    const [isReady, setIsReady] = useState(false)
    const { signInModal, selectExternalWallet } = useWallet()
    const web3Modal = useWeb3Modal()
    const { user } = useAuth()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()

    useEffect(() => {
        setIsReady(true)
    }, [])

    const isHome = pathName === '/home'
    const showFullPeanutWallet = useMemo(() => {
        const isPublicPath = publicPathRegex.test(pathName)
        return isPublicPath || (user?.user.hasPwAccess ?? false) || !peanutWalletIsInPreview
    }, [user, pathName])

    if (!isReady) return null
    return (
        <div className="flex h-[100dvh] flex-col  bg-background md:flex-row-reverse">
            <div
                className={classNames('z-1 flex w-full flex-1 overflow-x-visible overflow-y-scroll', {
                    'p-4 md:p-6': !isHome,
                })}
            >
                {showFullPeanutWallet ? children : <HomeWaitlist />}
            </div>
            {showFullPeanutWallet && <WalletNavigation />}
            <Modal
                visible={signInModal.visible}
                onClose={() => {
                    signInModal.close()
                }}
                title={'Sign In with your Peanut Wallet'}
            >
                <div className="flex flex-col items-center gap-2 p-5">
                    <Button
                        loading={isLoggingIn}
                        disabled={isLoggingIn}
                        onClick={() => {
                            handleLogin()
                                .then(signInModal.close)
                                .catch((e) => {
                                    console.error(e)
                                    toast.error('Error logging in')
                                })
                        }}
                    >
                        Sign In
                    </Button>
                    <Link href={'/setup'} className="text-h8 hover:underline">
                        Don't have a penanut wallet? Get one now.
                    </Link>
                    <div className="my-2 flex w-full items-center gap-4">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="text-sm text-gray-500">or</span>
                        <div className="h-px flex-1 bg-gray-200" />
                    </div>
                    <Button
                        loading={isLoggingIn}
                        disabled={isLoggingIn}
                        variant="dark"
                        shadowType="secondary"
                        onClick={() => {
                            web3Modal
                                .open()
                                .then(selectExternalWallet)
                                .catch((e) => {
                                    console.error(e)
                                    toast.error('Error connecting wallet')
                                })
                                .finally(signInModal.close)
                        }}
                    >
                        Connect External Wallet
                    </Button>
                </div>
            </Modal>
        </div>
    )
}

export default Layout
