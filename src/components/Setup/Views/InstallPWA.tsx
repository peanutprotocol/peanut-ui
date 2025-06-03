import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Icon } from '@/components/Global/Icons/Icon'
import Modal from '@/components/Global/Modal'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import UnsupportedBrowserModal from '@/components/Global/UnsupportedBrowserModal'
import { BeforeInstallPromptEvent, ScreenId } from '@/components/Setup/Setup.types'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const StepTitle = ({ text }: { text: string }) => <h3 className="text-xl font-extrabold leading-6">{text}</h3>

const InstallPWA = ({
    canInstall,
    deferredPrompt,
    deviceType,
    unsupportedBrowser,
    screenId,
}: {
    canInstall?: boolean
    deferredPrompt?: BeforeInstallPromptEvent | null
    deviceType?: 'ios' | 'android' | 'desktop'
    unsupportedBrowser?: boolean
    screenId?: ScreenId
}) => {
    const toast = useToast()
    const { handleNext, isLoading: isSetupFlowLoading } = useSetupFlow()
    const [showModal, setShowModal] = useState(false)
    const [installComplete, setInstallComplete] = useState(false)
    const [isPWAInstalled, setIsPWAInstalled] = useState(false)
    const dispatch = useAppDispatch()
    const { user } = useAuth()
    const { push } = useRouter()

    const [isUnsupportedBrowserLocal, setIsUnsupportedBrowserLocal] = useState(false)
    const [isLoadingLocal, setIsLoadingLocal] = useState(true)
    const [showUnsupportedBrowserModal, setShowUnsupportedBrowserModal] = useState(false)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsPWAInstalled(window.matchMedia('(display-mode: standalone)').matches)
        }
    }, [])

    useEffect(() => {
        if (!!user) push('/home')
    }, [user])

    useEffect(() => {
        setIsLoadingLocal(true)
        if (unsupportedBrowser !== undefined) {
            setIsUnsupportedBrowserLocal(unsupportedBrowser)
            setShowUnsupportedBrowserModal(unsupportedBrowser)
            setIsLoadingLocal(false)
        } else {
            if (typeof window !== 'undefined' && 'PublicKeyCredential' in window) {
                PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                    .then((hasPasskeySupport) => {
                        setIsUnsupportedBrowserLocal(!hasPasskeySupport)
                        setShowUnsupportedBrowserModal(!hasPasskeySupport)
                    })
                    .catch(() => {
                        setIsUnsupportedBrowserLocal(true)
                        setShowUnsupportedBrowserModal(true)
                    })
                    .finally(() => {
                        setIsLoadingLocal(false)
                    })
            } else {
                setIsUnsupportedBrowserLocal(true)
                setShowUnsupportedBrowserModal(true)
                setIsLoadingLocal(false)
            }
        }
    }, [unsupportedBrowser])

    useEffect(() => {
        const handleAppInstalled = () => {
            setTimeout(() => {
                setInstallComplete(true)
                setIsPWAInstalled(true)
                setShowModal(false)
                dispatch(setupActions.setLoading(false))
            }, 1000)
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('appinstalled', handleAppInstalled)
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('appinstalled', handleAppInstalled)
            }
        }
    }, [dispatch])

    useEffect(() => {
        if (
            screenId === 'pwa-install' &&
            (deviceType === 'desktop' || deviceType === 'ios') &&
            !isUnsupportedBrowserLocal
        ) {
            const timer = setTimeout(() => {
                setShowModal(true)
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [deviceType, screenId, isUnsupportedBrowserLocal])

    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return
        dispatch(setupActions.setLoading(true))
        try {
            await deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice
            if (outcome === 'accepted') {
                setInstallComplete(true)
            } else {
                dispatch(setupActions.setLoading(false))
            }
        } catch (error) {
            console.error('Error during PWA installation prompt:', error)
            toast.error('Error during PWA installation prompt')
            dispatch(setupActions.setLoading(false))
        }
    }, [deferredPrompt, dispatch])

    const AndroidPWASpecificInstallFlow = () => {
        if (isPWAInstalled || installComplete) {
            return (
                <div className="flex flex-col gap-4">
                    <Button onClick={() => handleNext()} className="w-full" shadowSize="4" loading={isSetupFlowLoading}>
                        Open Peanut app
                    </Button>
                </div>
            )
        }

        if (canInstall && deferredPrompt) {
            return (
                <Button
                    onClick={handleInstall}
                    disabled={isSetupFlowLoading}
                    className="w-full"
                    shadowSize="4"
                    loading={isSetupFlowLoading}
                >
                    Add Peanut to Home Screen
                </Button>
            )
        }
    }

    const DesktopInstructions = () => (
        <div className="flex flex-col items-center justify-center gap-6">
            <div className={'flex size-12 items-center justify-center rounded-full bg-primary-1'}>
                <Icon name="mobile-install" size={24} />
            </div>
            <div className="space-y-3 text-center">
                <StepTitle text="Peanut is mobile first!" />
                <p className="max-w-[220px] text-lg font-normal text-grey-1">
                    For a better experience, use Peanut on your phone.
                </p>
            </div>
            <div className="mx-auto rounded-lg">
                <QRCodeWrapper url={process.env.NEXT_PUBLIC_BASE_URL + '/setup' || window.location.origin} />
            </div>
        </div>
    )

    if (isLoadingLocal && screenId !== 'android-initial-pwa-install') {
        return (
            <div className="flex min-h-[100px] items-center justify-center">
                <Icon name="retry" className="animate-spin" size={24} />
            </div>
        )
    }

    if (isUnsupportedBrowserLocal) {
        return (
            <UnsupportedBrowserModal
                visible={showUnsupportedBrowserModal}
                onClose={() => {
                    setShowUnsupportedBrowserModal(false)
                }}
            />
        )
    }

    switch (screenId) {
        case 'android-initial-pwa-install':
            return <AndroidPWASpecificInstallFlow />
        case 'pwa-install':
            if (deviceType === 'android') {
                return <AndroidPWASpecificInstallFlow />
            }
            if (deviceType === 'desktop') {
                return (
                    <>
                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={() => setShowModal(true)}
                                className="w-full"
                                shadowSize="4"
                                variant="purple"
                            >
                                {isUnsupportedBrowserLocal
                                    ? 'Open in Main Browser'
                                    : installComplete
                                      ? 'Open in the App'
                                      : 'Install App'}
                            </Button>
                        </div>
                        {showModal && (
                            <Modal
                                visible={showModal}
                                onClose={() => setShowModal(false)}
                                className="items-center rounded-none"
                                classWrap="sm:m-auto sm:self-center self-center bg-background m-4 rounded-none border-0"
                            >
                                <div className="space-y-4 p-6">
                                    <DesktopInstructions />
                                    <Button
                                        onClick={() => setShowModal(false)}
                                        className="mt-4 w-full"
                                        shadowSize="4"
                                        variant="purple"
                                    >
                                        Got it!
                                    </Button>
                                </div>
                            </Modal>
                        )}
                    </>
                )
            }

        default:
            return null
    }
}

export default InstallPWA
