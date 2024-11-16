import { Button, Card } from '@/components/0_Bruddle'
import { useEffect, useState } from 'react'
import { useSetupFlow } from '../context/SetupFlowContext'
import Icon from '@/components/Global/Icon'

const StepTitle = ({ text }: { text: string }) => <h3 className="font-bold">{text}</h3>

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
                        <p>Tap 'Install App' from the menu options.</p>
                    </div>
                </>
            )}
        </div>
    )

    const DesktopInstructions = () => (
        <div className="flex flex-col gap-4">
            {canInstall ? (
                <Button onClick={handleInstall} className="w-full">
                    Install Peanut Wallet
                </Button>
            ) : (
                <>
                    <div>
                        <StepTitle text="Install on Desktop" />
                        <p>Look for the install icon in your browser's address bar and click it.</p>
                    </div>
                </>
            )}
        </div>
    )

    return (
        <>
            <Card>
                <Card.Content>
                    {deviceType === 'ios' && <IOSInstructions />}
                    {deviceType === 'android' && <AndroidInstructions />}
                    {deviceType === 'desktop' && <DesktopInstructions />}
                </Card.Content>
            </Card>
        </>
    )
}

export default InstallPWA
