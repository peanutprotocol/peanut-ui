import { Stack, Box } from '@chakra-ui/react'
import * as assets from '@/assets'
import { StoryImages } from './imageAssets'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'

type StoryProps = {
    stories: Array<{
        copy: string
    }>
    foot: string
    marquee?: {
        visible: boolean
        message?: string
    }
}

export function Story({ stories, foot, marquee = { visible: false } }: StoryProps) {
    return (
        <Box className="overflow-x-hidden">
            <Stack spacing={[14, 20, 28]} className="mx-auto max-w-4xl px-6 py-14 sm:py-20 md:px-8 md:py-36">
                {stories.map((story, index) => (
                    <Box key={index}>
                        <div className={`relative w-5/6 max-w-3xl md:w-4/5 ${index === 0 ? 'ml-auto' : ''}`}>
                            <StoryImages index={index} />

                            <p className="relative z-10 text-lg font-semibold uppercase md:text-xl md:leading-8">
                                {story.copy}
                            </p>
                        </div>

                        {index + 1 < stories.length && (
                            <Box className="mt-18 md:mt-20 lg:mt-28">
                                <img src={assets.HR.src} className="mx-auto h-5" />
                            </Box>
                        )}
                    </Box>
                ))}
                <div className="flex flex-col items-center justify-center">
                    <p className=" text-center  text-lg font-semibold uppercase md:text-xl">{foot}</p>
                </div>
            </Stack>

            {marquee.visible && (
                <Box borderY={'2px solid'} borderColor={'white'} className="shadow">
                    <MarqueeWrapper backgroundColor="bg-cyan-8" direction="left" className="border-y-2 border-n-1 py-1">
                        <div className="mx-2 font-display text-lg uppercase not-italic md:text-xl">
                            {marquee.message}
                        </div>

                        <div className="mx-2">
                            <img src={assets.SmileStars.src} className="animation-faceSpin h-auto w-9" />
                        </div>
                    </MarqueeWrapper>
                </Box>
            )}
        </Box>
    )
}
