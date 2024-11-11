import { Step } from '@/components/Setup/context/SetupFlowContext'
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

const placeAsset = (url: string) => {
    return <img src={url} className="z-10 h-full w-full object-contain" />
}

const staticPasskeyImage = (
    <div className="flex h-auto w-full max-w-[300px] flex-col items-center justify-center md:max-w-[400px]">
        <img src={eyes.src} className="w-[150px] object-contain md:w-[200px]" />
        <img src={fingerprint.src} className="animate-float mt-[30px] w-[170px] object-contain md:w-[220px]" />
    </div>
)

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
        screenId: 'welcome',
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
        title: 'Passkey',
        description: 'Add a passkey to secure your wallet',
        containerClassname: 'bg-yellow-1/100',
        component: () => <SetupPasskey />,
        centerComponent: () => {
            return staticPasskeyImage
        },
    },
    {
        screenId: 'contact-info',
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
        title: 'Success',
        description: "You're all set up! Let's get started",
        containerClassname: 'bg-green-1/100',
        component: () => <SetupSuccess />,
        centerComponent: () => {
            return <LetPeanutBeHappy />
        },
    },
]
