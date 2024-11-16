import { Button, Card } from '@/components/0_Bruddle'
import { useEffect, useState } from 'react'
import { useSetupFlow } from '../context/SetupFlowContext'
import Icon from '@/components/Global/Icon'

const StepTitle = ({ text }: { text: string }) => <h3 className="font-bold">{text}</h3>

const InstallPWADesktopIcon = () => {
    return (
        <svg
            version="1.0"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 160.000000 160.000000"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}
        >
            <g transform="translate(0.000000,160.000000) scale(0.100000,-0.100000)" fill="currentColor" stroke="none">
                <path d="M271 1382 c-71 -38 -71 -40 -71 -482 0 -364 1 -398 18 -429 30 -55 71 -71 186 -71 l100 0 -32 -33 c-30 -30 -32 -38 -32 -100 l0 -67 360 0 360 0 0 67 c0 62 -2 70 -32 100 l-32 33 100 0 c168 0 204 36 204 202 l0 98 -50 0 -50 0 0 -100 0 -100 -500 0 -500 0 0 400 0 400 200 0 200 0 0 50 0 50 -198 0 c-172 0 -202 -2 -231 -18z" />
                <path d="M880 1148 l0 -253 -88 88 -88 87 -52 -53 -53 -54 175 -179 176 -179 176 179 175 179 -53 54 -52 53 -88 -87 -88 -88 0 253 0 252 -70 0 -70 0 0 -252z" />
            </g>
        </svg>
    )
}

let deferredPrompt: any = null

const InstallPWA = () => {
    const { handleNext } = useSetupFlow()
    const [canInstall, setCanInstall] = useState(false)
    const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop')

    useEffect(() => {
        // Store the install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault()
            deferredPrompt = e
            setCanInstall(true)
        })

        // Detect when PWA is installed
        window.addEventListener('appinstalled', () => {
            // Wait a moment to let the install complete
            setTimeout(() => {
                handleNext()
                // Try to open the PWA
                window.location.href = window.location.origin + '/home'
            }, 1000)
        })

        // Detect device type
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const isMobileDevice = /Android|webOS|iPad|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        )

        if (isIOSDevice) {
            setDeviceType('ios')
        } else if (isMobileDevice) {
            setDeviceType('android')
        } else {
            setDeviceType('desktop')
        }
    }, [handleNext])

    const handleInstall = async () => {
        if (!deferredPrompt) return

        // Show the install prompt
        deferredPrompt.prompt()

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
            deferredPrompt = null
        }
    }

    const IOSInstructions = () => (
        <div className="flex flex-col gap-4">
            <div>
                <StepTitle text="Step 1: Open the Sharing Options" />
                <p>Tap the share icon at the bottom of your screen.</p>
            </div>

            <div>
                <StepTitle text="Step 2: Select 'Add to Home Screen'" />
                <p>Scroll down and tap 'Add to Home Screen' from the options list.</p>
            </div>

            <div>
                <StepTitle text="Step 3: Confirm and Add" />
                <p>Tap 'Add' to place the app icon on your home screen.</p>
            </div>
        </div>
    )

    const AndroidInstructions = () => (
        <div className="flex flex-col gap-4">
            {canInstall ? (
                <Button onClick={handleInstall} className="w-full">
                    Install Peanut Wallet
                </Button>
            ) : (
                <>
                    <div>
                        <StepTitle text="Step 1: Open the Menu" />
                        <p>Tap the three dots menu at the top of your screen.</p>
                    </div>

                    <div>
                        <StepTitle text="Step 2: Select 'Install App'" />
                        <p>Tap 'Add to Home Screen' or 'Install app' from the menu options.</p>
                    </div>
                </>
            )}
        </div>
    )

    const DesktopInstructions = () => (
        <div className="flex flex-col gap-4">
            {canInstall ? (
                <Button onClick={handleInstall} className="w-full">
                    <InstallPWADesktopIcon />
                    Install Peanut Wallet
                </Button>
            ) : (
                <>
                    <div>
                        <StepTitle text="Install on Desktop" />
                        <p>
                            Look for the install icon (<InstallPWADesktopIcon />) in your browser's address bar and
                            click it.
                        </p>
                    </div>
                </>
            )}
        </div>
    )

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <Card.Content>
                    {deviceType === 'ios' && <IOSInstructions />}
                    {deviceType === 'android' && <AndroidInstructions />}
                    {deviceType === 'desktop' && <DesktopInstructions />}
                </Card.Content>
            </Card>
            <Button
                onClick={(e) => {
                    e.preventDefault()
                    handleNext()
                }}
                variant="stroke"
            >
                Done
            </Button>
        </div>
    )
}

export default InstallPWA
