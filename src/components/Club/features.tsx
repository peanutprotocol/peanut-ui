import { Stack, Box, Flex, SimpleGrid, GridItem } from '@chakra-ui/react'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'
import * as assets from '@/assets'

type FeaturesProps = {
    sections: Array<{
        heading: string
        list?: Array<string>
        testimonials?: Array<{
            imageSrc: string
            altText: string
            comment: string
            name: string
            detail: string
            detailRedirectUrl?: string
            bgColorClass: string
        }>
    }>
    marquee: {
        visible: boolean
        message?: string
    }
}

export function Features({ sections, marquee = { visible: false } }: FeaturesProps) {
    return (
        <Flex direction={'column'} width={'100%'}>
            <Stack spacing={[14, 20, 28, 36]} className="overflow-x-hidden px-6 py-14 sm:py-20 md:px-8 md:py-36">
                {sections.map((section, index) => (
                    <Box key={index} className="relative">
                        {index === 0 && (
                            <>
                                <img
                                    src={assets.SmileHigh.src}
                                    className="absolute -left-10 -top-6 w-30 md:-top-16 md:left-[1%] lg:left-[14%] xl:left-[20%]"
                                />
                                <img
                                    src={assets.SmileFinder.src}
                                    className="absolute -left-12 top-8 w-28 md:-left-[2%] md:-top-4 lg:left-[12%] xl:left-[18%]"
                                />
                                <img
                                    src={assets.HandSnap.src}
                                    className="absolute -right-6 top-2 w-20 md:-top-8 md:right-[1%] md:w-28 lg:-top-12 lg:right-[10%] xl:right-[20%]"
                                />
                            </>
                        )}

                        {index === 1 && (
                            <>
                                <img
                                    src={assets.Star.src}
                                    className="absolute -top-6 left-0 w-14 -rotate-3 md:left-[3%] lg:left-[2%] xl:left-[8%]"
                                />
                                <img
                                    src={assets.GoodIdeaSign.src}
                                    className="absolute -right-20 top-20 w-48 rotate-6 md:right-[2%] md:top-18 lg:-right-[3%] lg:top-32 xl:right-[7%] xl:top-18"
                                />
                                <img
                                    src={assets.EyesEmoiji.src}
                                    className="absolute -left-16 bottom-0 w-36 -rotate-6 md:-bottom-12 lg:-bottom-8 lg:left-[0%] xl:-bottom-18 xl:left-[7%]"
                                />
                                <img
                                    src={assets.HandBag.src}
                                    className="absolute -bottom-16 right-[0%] hidden w-36 md:block lg:-bottom-32 lg:right-[20%] xl:-bottom-18 xl:right-6"
                                />
                            </>
                        )}

                        <div className={`relative z-1 mx-auto lg:px-4 xl:w-4/5`}>
                            <h2 className="font-display text-center text-2xl font-black uppercase text-n-1">
                                {section.heading}
                            </h2>

                            {section.testimonials && (
                                <SimpleGrid
                                    spacing={8}
                                    columns={{ sm: 1, md: 2, lg: 4 }}
                                    className="mt-12 items-start md:mt-20"
                                >
                                    {section.testimonials.map((testimonial, index) => (
                                        <GridItem
                                            key={index}
                                            className={`testimonial border-2- border-n-1- bg-white- shadow-md- ring-2- ring-white- relative rounded-3xl p-4 md:p-8 testimonial-${index} ${testimonial.bgColorClass} ${index % 2 === 0 ? 'mt-' + index * 1 : 'mt-' + index * 4}`}
                                        >
                                            <img
                                                src={testimonial.imageSrc}
                                                alt={testimonial.altText}
                                                className="mx-auto h-20 w-20 rounded-full"
                                            />

                                            <div className="mt-4 text-center text-lg font-semibold leading-6">
                                                {testimonial.comment}
                                            </div>

                                            <div className="mt-4 text-center">
                                                <div className="font-semibold">
                                                    {testimonial.name}, {testimonial.detail}
                                                </div>
                                            </div>
                                        </GridItem>
                                    ))}
                                </SimpleGrid>
                            )}

                            {section.list && (
                                <Flex className="mt-12" gap={4} wrap={'wrap'}>
                                    <img
                                        src={assets.ClaimChainsBadge.src}
                                        className="mx-auto w-80 -rotate-6 md:mt-8"
                                        alt="Send a link. Claim on 20+ Chains."
                                    />

                                    <Stack spacing={4} className="mx-auto mt-12 flex text-center md:text-left lg:mt-0">
                                        {section.list.map((item, index) => (
                                            <Box
                                                key={index}
                                                className={`font-display border-violet-3 text-violet-3 mx-auto flex w-auto rounded-full border-2 px-5 py-3 text-[1.4rem] font-bold uppercase shadow ring-2 ring-white md:mr-auto md:text-[2rem] ${index % 2 === 0 ? 'bg-violet-3 text-white' : 'bg-white'}`}
                                            >
                                                {item}
                                            </Box>
                                        ))}
                                    </Stack>
                                </Flex>
                            )}
                        </div>

                        {index + 1 < sections.length && (
                            <Box className="mt-16 md:mt-20 lg:mt-28 xl:mt-36">
                                <img src={assets.HR.src} className="mx-auto h-5" />
                            </Box>
                        )}
                    </Box>
                ))}
            </Stack>

            {marquee.visible && (
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
        </Flex>
    )
}
