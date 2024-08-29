import { Stack, Box } from '@chakra-ui/react'
import * as assets from '@/assets'
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
                            {index === 0 && (
                                <>
                                    <img
                                        src={assets.StopSign.src}
                                        className="absolute -left-[52%] -top-4 w-40 -rotate-3 md:-left-[28%]"
                                    />
                                    <img src={assets.Star.src} className="absolute -left-[32%] top-[42%] w-14" />
                                </>
                            )}

                            {index === 1 && (
                                <>
                                    <img
                                        src={assets.EasySign.src}
                                        className="absolute -right-[66%] top-[20%] w-48 rotate-6 md:-right-[38%] lg:-right-[48%]"
                                    />
                                    <img
                                        src={assets.HeyDudeSign.src}
                                        className="absolute -right-[48%] -top-2 w-40 -rotate-3 md:-right-[25%] lg:-right-[35%]"
                                    />

                                    <img src={assets.Star.src} className="absolute -bottom-16 -right-[8%] w-14" />
                                </>
                            )}

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
                    <MarqueeWrapper backgroundColor="bg-cyan-8" direction="left" className="border-y-2 border-n-1 py-2">
                        <div className="font-display mx-2 text-lg uppercase not-italic md:text-xl">
                            {marquee.message}
                        </div>

                        <div className="mx-2">
                            <img src={assets.SmileFinder.src} className="h-auto w-8" />
                        </div>
                    </MarqueeWrapper>
                </Box>
            )}
        </Box>
    )
}
