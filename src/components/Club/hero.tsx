import { Stack, Center, Box } from '@chakra-ui/react'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'
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
    const marqueeMessage = 'Peanut Frens'

    return (
        <Stack className="relative overflow-x-hidden">
            <HeroImages />

            <Center height={`calc(100vh - 4rem - 4rem)`}>
                <h1 className="-mt-4 text-center font-display text-3xl font-black uppercase text-violet-3 md:text-4xl">
                    {heading}
                </h1>
            </Center>

            {marquee && (
                <Box borderY={'2px solid'} borderColor={'white'} className="shadow">
                    <MarqueeWrapper backgroundColor="bg-cyan-8" direction="left" className="border-y-2 border-n-1">
                        <div className="mx-3 font-display text-lg uppercase not-italic md:text-xl">
                            {marquee.message}
                        </div>

                        <div className="mx-3 py-2">
                            <img src={assets.HandThumbs.src} className="animation-thumbsUp h-auto w-8" />
                        </div>
                    </MarqueeWrapper>
                </Box>
            )}
        </Stack>
    )
}
