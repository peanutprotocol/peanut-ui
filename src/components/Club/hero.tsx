import { Stack, Center, Box } from '@chakra-ui/react'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'
import * as assets from '@/assets'

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
            <img src={assets.Star.src} className="absolute left-[16%] top-[20%] w-12 lg:top-[28%]" />
            <img src={assets.Star.src} className="absolute right-[14%] top-[66%] w-12  lg:top-[54%]" />
            <img
                src={assets.HandToken.src}
                className="absolute left-[7%] top-[63%] w-36 md:left-[10%] md:top-[70%] lg:left-[7%] lg:top-[63%] xl:left-[11%]"
            />

            <Center height={`calc(100vh - 4rem - 4rem)`}>
                <h1 className="font-display text-violet-3 -mt-4 text-center text-3xl font-black uppercase md:text-4xl">
                    {heading}
                </h1>
            </Center>

            {marquee && (
                <Box borderY={'2px solid'} borderColor={'white'} className="shadow">
                    <MarqueeWrapper backgroundColor="bg-cyan-8" direction="left" className="border-y-2 border-n-1 py-2">
                        <div className="font-display mx-3 text-lg uppercase not-italic md:text-xl">
                            {marquee.message}
                        </div>
                        <div className="mx-3">
                            <img src={assets.HandThumbs.src} className="h-auto w-8" />
                        </div>
                    </MarqueeWrapper>
                </Box>
            )}
        </Stack>
    )
}
