import { Stack, Box } from '@chakra-ui/react'
import { Eyes, PeanutGuy } from '@/assets'
import { StoryImages } from './imageAssets'
import { MarqueeComp } from '../Global/MarqueeWrapper'
import { NutsDivider } from './nutsDivider'

type StoryProps = {
    stories?: Array<{
        copy: string
    }>
    foot?: string
    marquee?: {
        visible: boolean
        message?: string
    }
}

export function Story({ stories, foot, marquee = { visible: false } }: StoryProps) {
    return (
        <Box className="my-6 overflow-x-hidden md:my-10">
            <Stack spacing={[12, 20]} className="mx-auto max-w-4xl px-6 py-12 sm:py-20 md:space-y-8 md:px-8 lg:py-20">
                <Box className="relative">
                    {/* <StoryImages index={0} /> */}
                    <img src={PeanutGuy.src} className="mx-auto h-auto w-1/2 md:w-2/5" alt="" />
                </Box>

                <NutsDivider height="h-8" />

                <Box className="relative">
                    {/* <StoryImages index={1} /> */}
                    <img src={PeanutGuy.src} className="mx-auto h-auto w-1/2 md:w-2/5" alt="" />
                </Box>
            </Stack>

            {marquee.visible && (
                <MarqueeComp message={marquee.message} imageSrc={Eyes.src} imageAnimationClass="animation-rock" />
            )}
        </Box>
    )
}
