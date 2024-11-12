import WelcomeStep from './Views/Welcome'
import SetupPasskey from './Views/SetupPasskey'
import SetupSuccess from './Views/Success'
import fingerprint from '@/assets/icons/fingerprint.png'
import eyes from '@/assets/icons/eyes.png'
import ContactInfo from './Views/ContactInfo'

import happyPeanutAnimi from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_03.gif'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import sadPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_04.gif'
import pointingPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_06.gif'
import { useState } from 'react'
import { Step } from './Setup.types'
import InstallPWA from './Views/InstallPWA'
import { peanutWalletIsInPreview } from '@/constants'

const placeAsset = (url: string) => {
    return <img src={url} className="z-10 h-full w-full object-contain md:w-1/2" />
}

const LetPeanutBeHappy = () => {
    const [peanutCantMove, setPeanutCantMove] = useState(false)

    return (
        <div className="h-full w-full">
            <img
                src={peanutCantMove ? sadPeanutAnim.src : happyPeanutAnimi.src}
                className={`h-full w-full object-contain `}
                onMouseDown={() => setPeanutCantMove(true)}
                onMouseUp={() => setPeanutCantMove(false)}
                onPointerDown={() => setPeanutCantMove(true)}
                onPointerUp={() => setPeanutCantMove(false)}
            />
        </div>
    )
}

export const SETUP_STEPS: Step[] = [
    {
        screenId: 'pwa-install',
        active: peanutWalletIsInPreview,
        title: 'Install',
        description: 'Install the peanut wallet app on your device !',
        containerClassname: 'bg-blue-1/100 text-black',
        component: () => <InstallPWA />,
        centerComponent: () => {
            return placeAsset(pointingPeanutAnim.src)
        },
    },
    {
        screenId: 'welcome',
        active: true,
        title: 'Welcome',
        description: 'Create your brand new peanut wallet now ! Choose a handle',
        containerClassname: 'bg-blue-1/100',
        component: () => <WelcomeStep />,
        centerComponent: () => {
            return placeAsset(chillPeanutAnim.src)
        },
    },
    {
        screenId: 'passkey',
        active: true,
        title: 'Passkey',
        description: 'Add a passkey to secure your wallet',
        containerClassname: 'bg-yellow-1/100',
        component: () => <SetupPasskey />,
        centerComponent: () => {
            return (
                <div className="flex h-full w-2/3 flex-col items-center justify-center md:max-w-[400px]">
                    <img src={eyes.src} className="w-full object-contain md:w-[200px]" />
                    <img src={fingerprint.src} className="mt-[40px] w-full object-contain md:w-[220px]" />
                </div>
            )
        },
    },
    {
        screenId: 'contact-info',
        active: peanutWalletIsInPreview,
        title: 'Contact',
        description: 'Add your contact info to make it easier for us to reach you !',
        containerClassname: 'bg-purple-1/100',
        component: () => <ContactInfo />,
        centerComponent: () => {
            return placeAsset(pointingPeanutAnim.src)
        },
    },
    {
        screenId: 'success',
        active: true,
        title: 'Success',
        description: "You're all set up! Let's get started",
        containerClassname: 'bg-green-1/100',
        component: () => <SetupSuccess />,
        centerComponent: () => {
            return <LetPeanutBeHappy />
        },
    },
].filter((step) => step.active)
