import { Button } from '@/components/0_Bruddle'
import { useEffect, useState } from 'react'
import { useSetupFlow } from '../context/SetupFlowContext'
import Icon from '@/components/Global/Icon'

const StepTitle = ({ text }: { text: string }) => <h3 className="mt-4 font-bold text-white">{text}</h3>

const InstallPWA = () => {
    const { handleNext, handleBack } = useSetupFlow()
    const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop')

    useEffect(() => {
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
    }, [])

    const IOSInstructions = () => (
        <>
            <StepTitle text="Step 1: Open the Sharing Options" />
            <p>Tap the share icon at the bottom of your screen.</p>

            <StepTitle text="Step 2: Select 'Add to Home Screen'" />
            <p>Scroll down and tap 'Add to Home Screen' from the options list.</p>

            <StepTitle text="Step 3: Confirm and Add" />
            <p>Customize the name if needed, then tap 'Add' to place the app icon on your home screen.</p>
        </>
    )

    const AndroidInstructions = () => (
        <>
            <StepTitle text="Step 1: Open the Menu" />
            <p>Tap the three dots menu at the top of your screen.</p>

            <StepTitle text="Step 2: Select 'Add to Home Screen'" />
            <p>Scroll down and tap 'Add to Home Screen' from the options list.</p>

            <StepTitle text="Step 3: Confirm and Add" />
            <p>Tap 'Install' to place the app icon on your home screen.</p>
        </>
    )

    const DesktopInstructions = () => (
        <>
            <StepTitle text="Mobile App Available" />
            <p>This app is available as a Progressive Web App (PWA) on mobile devices.</p>
            <p className="mt-2">To install, please open this website on your iOS or Android device.</p>
        </>
    )

    return (
        <div className="flex flex-col gap-2 text-center backdrop-blur-lg">
            {deviceType === 'ios' && <IOSInstructions />}
            {deviceType === 'android' && <AndroidInstructions />}
            {deviceType === 'desktop' && <DesktopInstructions />}
            <div className="mt-4 flex flex-row items-center gap-2">
                <Button onClick={handleBack} variant="stroke">
                    <Icon name="arrow-prev" />
                </Button>
                <Button onClick={() => handleNext()}>Skip</Button>
            </div>
        </div>
    )
}

export default InstallPWA
