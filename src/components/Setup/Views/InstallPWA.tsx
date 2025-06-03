import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import ErrorAlert from '@/components/Global/ErrorAlert'
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
    const [installCancelled, setInstallCancelled] = useState(false)
    const [isInstallInProgress, setIsInstallInProgress] = useState(false)

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
                setIsInstallInProgress(false)
                setInstallCancelled(false)
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
        setIsInstallInProgress(true)
        setInstallCancelled(false)
        try {
            await deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice
            if (outcome === 'accepted') {
                // 'appinstalled' event will handle completion
                // If appinstalled doesn't fire reliably, might need a fallback here
                // For now, we let appinstalled handle setInstallComplete
            } else {
                // outcome === 'dismissed'
                setInstallCancelled(true)
                dispatch(setupActions.setLoading(false)) // Stop global loading if any was set
                setIsInstallInProgress(false)
            }
        } catch (error) {
            console.error('Error during PWA installation prompt:', error)
            toast.error('PWA installation failed. Please try again.')
            dispatch(setupActions.setLoading(false)) // stop global loading
            setIsInstallInProgress(false)
        }
    }, [deferredPrompt, dispatch, toast])

    const AndroidPWASpecificInstallFlow = () => {
        if (isPWAInstalled || installComplete) {
            return (
                <div className="flex flex-col gap-4">
                    <Button
                        onClick={() => {
                            if (window.matchMedia('(display-mode: standalone)').matches) {
                                // Already in PWA, proceed to the next logical step (e.g., welcome)
                                handleNext()
                            } else {
                                // not in PWA, try to launch it by navigating to its start_url, but targeting the setup flow
                                window.location.href = '/setup'
                            }
                        }}
                        className="w-full"
                        shadowSize="4"
                        loading={isSetupFlowLoading} // This loading is from useSetupFlow, for page transitions
                    >
                        Open Peanut app
                    </Button>
                </div>
            )
        }

        if (canInstall && deferredPrompt) {
            return (
                <div className="flex flex-col items-center gap-4">
                    <Button
                        onClick={handleInstall}
                        disabled={isInstallInProgress || isSetupFlowLoading}
                        className="w-full"
                        shadowSize="4"
                        loading={isInstallInProgress}
                    >
                        Add Peanut to Home Screen
                    </Button>
                    {installCancelled && (
                        <ErrorAlert description="Installation cancelled. You can try adding to Home Screen again." />
                    )}
                </div>
            )
        }
        // Fallback if PWA cannot be installed via prompt (e.g. already installed but states are not synced, or no prompt event)
        // This part might need review based on how `canInstall` and `deferredPrompt` behave post-install attempt if appinstalled is missed
        return (
            <div className="space-y-2 text-center">
                <p className="text-sm text-grey-1">Could not initiate automatic installation.</p>
                <p className="text-sm text-grey-1">Please try adding to Home Screen manually via your browser menu.</p>
                <Button onClick={() => handleNext()} className="mt-4 w-full" shadowSize="4" variant="purple">
                    Continue
                </Button>
            </div>
        )
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
