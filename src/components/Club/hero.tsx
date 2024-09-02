import { Stack, Center, Box } from '@chakra-ui/react'
import { MarqueeComp } from '../Global/MarqueeWrapper'
import * as assets from '@/assets'
import { HeroImages } from './imageAssets'

type HeroProps = {
    heading: string
    marquee?: {
        visible: boolean
        message?: string
    }
}

export function Hero({ heading, marquee = { visible: false } }: HeroProps) {
    return (
        <Stack className="relative overflow-x-hidden">
            <HeroImages />

            <Center height={`calc(100vh - 4rem - 4rem)`}>
                <h1 className="-mt-4 text-center font-display text-7xl font-black uppercase text-violet-3 md:text-8xl">
                    {heading}
                </h1>
            </Center>

            {marquee && <MarqueeComp message={marquee.message} imageSrc={assets.HandThumbs.src} />}
        </Stack>
    )
}
