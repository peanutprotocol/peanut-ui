import peanutPointing from '@/animations/512x512_PNGS_ALPHA_BACKGROUND/PNGS_512_konradurban_06/PNGS_konradurban_06_11.png'
import { Button } from '@/components/0_Bruddle'
import Modal from '@/components/Global/Modal'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useEffect, useState, useCallback } from 'react'
import { BeforeInstallPromptEvent } from '@/components/Setup/Setup.types'
import { setupActions } from '@/redux/slices/setup-slice'
import { useAppDispatch } from '@/redux/hooks'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/authContext'

const StepTitle = ({ text }: { text: string }) => <h3 className="text-xl font-extrabold leading-6">{text}</h3>

const InstallPWADesktopIcon = () => {
    return (
        <svg
            version="1.0"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 160.000000 160.000000"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px', marginRight: '4px' }}
        >
            <g transform="translate(0.000000,160.000000) scale(0.100000,-0.100000)" fill="currentColor" stroke="none">
                <path d="M271 1382 c-71 -38 -71 -40 -71 -482 0 -364 1 -398 18 -429 30 -55 71 -71 186 -71 l100 0 -32 -33 c-30 -30 -32 -38 -32 -100 l0 -67 360 0 360 0 0 67 c0 62 -2 70 -32 100 l-32 33 100 0 c168 0 204 36 204 202 l0 98 -50 0 -50 0 0 -100 0 -100 -500 0 -500 0 0 400 0 400 200 0 200 0 0 50 0 50 -198 0 c-172 0 -202 -2 -231 -18z" />
                <path d="M880 1148 l0 -253 -88 88 -88 87 -52 -53 -53 -54 175 -179 176 -179 176 179 175 179 -53 54 -52 53 -88 -87 -88 -88 0 253 0 252 -70 0 -70 0 0 -252z" />
            </g>
        </svg>
    )
}

const ShareIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24px"
        height="24px"
        viewBox="0 0 24 24"
        className="relative -top-0.5 inline !h-5"
    >
        <g>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M11.4697 1.71967C11.7626 1.42678 12.2374 1.42678 12.5303 1.71967L16.2803 5.46967C16.5732 5.76256 16.5732 6.23744 16.2803 6.53033C15.9874 6.82322 15.5126 6.82322 15.2197 6.53033L12.75 4.06066V15.0469C12.75 15.4611 12.4142 15.7969 12 15.7969C11.5858 15.7969 11.25 15.4611 11.25 15.0469V4.06066L8.78033 6.53033C8.48744 6.82322 8.01256 6.82322 7.71967 6.53033C7.42678 6.23744 7.42678 5.76256 7.71967 5.46967L11.4697 1.71967ZM6.375 9.75C6.07663 9.75 5.79048 9.86853 5.5795 10.0795C5.36853 10.2905 5.25 10.5766 5.25 10.875V19.875C5.25 20.1734 5.36853 20.4595 5.5795 20.6705C5.79048 20.8815 6.07663 21 6.375 21H17.625C17.9234 21 18.2095 20.8815 18.4205 20.6705C18.6315 20.4595 18.75 20.1734 18.75 19.875V10.875C18.75 10.5766 18.6315 10.2905 18.4205 10.0795C18.2095 9.86853 17.9234 9.75 17.625 9.75H15.75C15.3358 9.75 15 9.41421 15 9C15 8.58579 15.3358 8.25 15.75 8.25H17.625C18.3212 8.25 18.9889 8.52656 19.4812 9.01884C19.9734 9.51113 20.25 10.1788 20.25 10.875V19.875C20.25 20.5712 19.9734 21.2389 19.4812 21.7312C18.9889 22.2234 18.3212 22.5 17.625 22.5H6.375C5.67881 22.5 5.01113 22.2234 4.51884 21.7312C4.02656 21.2389 3.75 20.5712 3.75 19.875V10.875C3.75 10.1788 4.02656 9.51113 4.51884 9.01884C5.01113 8.52656 5.67881 8.25 6.375 8.25H8.25C8.66421 8.25 9 8.58579 9 9C9 9.41421 8.66421 9.75 8.25 9.75H6.375Z"
                    fill="currentColor"
                />
            </svg>
        </g>
    </svg>
)

const InstallPWA = ({
    canInstall,
    deferredPrompt,
    deviceType,
    unsupportedBrowser,
}: {
    canInstall?: boolean
    deferredPrompt?: BeforeInstallPromptEvent | null
    deviceType?: 'ios' | 'android' | 'desktop'
    unsupportedBrowser?: boolean
}) => {
    const { handleNext, isLoading } = useSetupFlow()
    const [showModal, setShowModal] = useState(false)
    const [installComplete, setInstallComplete] = useState(false)
    const dispatch = useAppDispatch()
    const { isKernelClientReady } = useZeroDev()
    const { user } = useAuth()
    const { push } = useRouter()

    // Use the prop if provided, otherwise detect locally
    const [isUnsupportedBrowser, setIsUnsupportedBrowser] = useState(false)

    // Redirect to home if user is logged in
    useEffect(() => {
        if (!!user && isKernelClientReady) {
            push('/home')
        }
    }, [isKernelClientReady, user])

    useEffect(() => {
        // Use the prop value if it exists
        if (unsupportedBrowser !== undefined) {
            setIsUnsupportedBrowser(unsupportedBrowser)
        } else {
            // Otherwise detect it
            const checkPasskeySupport = async () => {
                try {
                    const hasPasskeySupport = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                    setIsUnsupportedBrowser(!hasPasskeySupport)
                } catch (error) {
                    // If there's an error checking, assume it's unsupported
                    setIsUnsupportedBrowser(true)
                }
            }

            checkPasskeySupport()
        }
    }, [unsupportedBrowser])

    useEffect(() => {
        if (!isUnsupportedBrowser) {
            handleNext()
        }
    }, [isUnsupportedBrowser])

    useEffect(() => {
        // Detect when PWA is installed
        window.addEventListener('appinstalled', () => {
            // Wait a moment to let the install complete
            setTimeout(() => {
                setInstallComplete(true)
                setShowModal(false)
                dispatch(setupActions.setLoading(false))
            }, 1000)
        })
    }, [])

    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return
        dispatch(setupActions.setLoading(true))
        // Show the install prompt
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'dismissed') {
            dispatch(setupActions.setLoading(false))
        } else if (outcome === 'accepted') {
            setTimeout(() => {
                setInstallComplete(true)
                dispatch(setupActions.setLoading(false))
            }, 5000)
        }
    }, [deferredPrompt])

    const IOSInstructions = () => (
        <div className="space-y-4">
            <StepTitle text="Install Peanut" />
            <p>
                To add Peanut to your Home screen, tap the (<ShareIcon />) icons and then {`"Add to home screen"`} in
                your browser.
            </p>
        </div>
    )

    const AndroidInstructions = () => (
        <div className="flex flex-col gap-4">
            {installComplete ? (
                <>
                    <div className="space-y-4">
                        <StepTitle text="Open Peanut App" />
                        <p className="mt-2">
                            You have already installed Peanut on your phone. Open it and continue the setup there!
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <div className="space-y-4">
                        <StepTitle text="Install Peanut" />
                        <p className="mt-2">1. Tap the three dots menu at the top of your screen.</p>
                        <p>2. Tap 'Add to Home Screen' or 'Install app' from the menu options.</p>
                    </div>
                </>
            )}
        </div>
    )

    // Desktop instructions tell the user to install on their phone
    const DesktopInstructions = () => (
        <div>
            <div className="space-y-4">
                <StepTitle text="Install on your Phone" />
                <p className="mb-4">
                    For the best experience, we recommend installing Peanut on your phone. Scan this QR code with your
                    phone's camera:
                </p>
                <div className="mx-auto rounded-lg bg-background p-4">
                    <QRCodeWrapper url={process.env.NEXT_PUBLIC_BASE_URL + '/setup' || window.location.origin} />
                </div>
                {/* TODO: we need to have setup instructions after login! This currently wont fully work */}
                <p className="text-center text-sm text-gray-600">
                    After scanning, log in with your passkey and follow the installation instructions.
                </p>
                {canInstall && (
                    <div className="mt-4 border-t pt-4">
                        <p className="mb-2 text-sm text-gray-600">Alternatively, you can install on desktop:</p>
                        <Button onClick={handleInstall} className="w-full">
                            <InstallPWADesktopIcon />
                            Install Peanut
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )

    const UnsupportedBrowserInstructions = () => (
        <div className="space-y-4">
            <StepTitle text="Browser Not Supported" />
            <p className="mt-2">
                It looks like you're using an in-app browser (like Telegram or Discord) that doesn't support passkeys,
                which are required for secure access to your wallet.
            </p>
            <p className="mt-2">
                Please open this link in your device's main browser (like Safari, Chrome, or Firefox):
            </p>
            <div className="mt-4 rounded-lg bg-gray-100 p-3 text-center">
                <code className="select-all font-mono text-sm">{window.location.origin}/setup</code>
            </div>
            <p className="mt-2 text-sm text-gray-600">
                Tap the button below to open in your main browser, or copy the link above manually.
            </p>
        </div>
    )

    const getInstructions = () => {
        console.log('Showing instructions for:', deviceType, 'Unsupported browser:', isUnsupportedBrowser)

        // If this is an unsupported browser, show those instructions
        if (isUnsupportedBrowser) {
            return <UnsupportedBrowserInstructions />
        } else if (deviceType === 'desktop') {
            return <DesktopInstructions />
        } else if (deviceType === 'ios') {
            return <IOSInstructions />
        } else {
            return <AndroidInstructions />
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <Button
                loading={isLoading}
                disabled={isLoading}
                onClick={() => {
                    if (isUnsupportedBrowser || installComplete) {
                        // Open in default browser
                        window.open(window.location.origin + '/setup', '_blank')
                    } else if (canInstall) {
                        handleInstall()
                    } else {
                        setShowModal(true)
                    }
                }}
                className="w-full"
                shadowSize="4"
            >
                {isUnsupportedBrowser ? 'Open in Main Browser' : installComplete ? 'Open in the App' : 'Install App'}
            </Button>

            <Modal
                visible={showModal}
                onClose={() => setShowModal(false)}
                className="items-center rounded-none"
                classWrap="sm:m-auto sm:self-center self-center bg-background m-4 rounded-none border-0"
            >
                {deviceType !== 'desktop' && (
                    <img
                        className="mx-auto pt-6 md:w-6/12"
                        width={200}
                        height={200}
                        src={peanutPointing.src}
                        alt="Peanut pointing"
                    />
                )}
                <div className="space-y-4 p-6">
                    {getInstructions()}
                    {!canInstall && (
                        <Button
                            onClick={() => {
                                setShowModal(false)
                            }}
                            className="w-full bg-white"
                            shadowSize="4"
                            variant="stroke"
                        >
                            Got it!
                        </Button>
                    )}
                </div>
            </Modal>
        </div>
    )
}

export default InstallPWA
