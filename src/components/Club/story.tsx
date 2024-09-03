import { Stack, Box } from '@chakra-ui/react'
import * as assets from '@/assets'
import { StoryImages } from './imageAssets'
import { MarqueeComp } from '../Global/MarqueeWrapper'

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
            <Stack spacing={[12, 20]} className="mx-auto max-w-4xl px-6 py-12 sm:py-20 md:px-8 lg:py-20">
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
                <MarqueeComp
                    message={marquee.message}
                    imageSrc={assets.SmilePink.src}
                    imageAnimationClass="animation-faceSpin"
                />
            )}
        </Box>
    )
}
