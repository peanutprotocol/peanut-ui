import { useRef } from 'react'
import { Stack, Box, Flex, SimpleGrid, GridItem } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useMediaQuery } from '@chakra-ui/react'

interface Testimonial {
    name: string
    comment: string
    detail: string
    imageSrc: string
    altText: string
    bgColorClass: string
}

type TestimonialsProps = {
    testimonials: Testimonial[]
}

export function Testimonials({ testimonials }: TestimonialsProps) {
    const ref = useRef(null)
    const [isLargerThan768] = useMediaQuery('(min-width: 768px)')

    // Animation variants
    const gridItemVariants = [
        {
            hidden: { opacity: 0, translateY: 20, translateX: 0, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 0,
                translateX: 0,
                rotate: 0.25,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: -8,
                translateX: -3,
                rotate: 2,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 20, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 28,
                translateX: 0,
                rotate: -0.15,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 14,
                translateX: -5,
                rotate: -2,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 20, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 2,
                translateX: 0,
                rotate: -0.05,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: -12,
                translateX: -6,
                rotate: -2,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 20, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 38,
                translateX: 2,
                rotate: 0.05,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 46,
                translateX: 2,
                rotate: -2,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
    ]

    const testimonialBgVariants = [
        {
            hidden: { opacity: 0, translateY: 0, translateX: 0, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 1.5,
                translateX: -1,
                rotate: -6,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 3,
                translateX: -3,
                rotate: -8,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 0, translateX: 0, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 1.3,
                translateX: 1.6,
                rotate: 4,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 8,
                translateX: 5,
                rotate: 6,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 0, translateX: 0, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: 6,
                translateX: 10,
                rotate: 4,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: 12,
                translateX: 12,
                rotate: 5,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
        {
            hidden: { opacity: 0, translateY: 0, translateX: 0, rotate: 0 },
            visible: {
                opacity: 1,
                translateY: -0.5,
                translateX: 0.5,
                rotate: -4,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
            hover: {
                opacity: 1,
                translateY: -5.5,
                translateX: 3.5,
                rotate: -5,
                transition: { duration: 0.4, type: 'spring', damping: 14 },
            },
        },
    ]

    return (
        <div className={``}>
            <SimpleGrid spacing={8} columns={{ sm: 1, md: 2, lg: testimonials.length }} className="items-start px-8">
                {testimonials.map((testimonial, index) => (
                    <GridItem key={index}>
                        {isLargerThan768 ? (
                            <motion.div
                                ref={ref}
                                initial="hidden"
                                whileInView="visible"
                                variants={gridItemVariants[index]}
                                whileHover="hover"
                                className={`relative z-10 p-4 md:p-8`}
                            >
                                <motion.div
                                    variants={testimonialBgVariants[index]}
                                    className={`absolute left-0 top-0 -z-1 h-full w-full rounded-3xl bg-primary testimonial-${index}-bg`}
                                ></motion.div>

                                <TestimonialBody testimonial={testimonial} />
                            </motion.div>
                        ) : (
                            <div className={`relative z-10 p-4 md:p-8`}>
                                <div
                                    className={`absolute left-0 top-0 -z-1 h-full w-full rounded-3xl bg-primary testimonial-${index}-bg`}
                                ></div>
                                <TestimonialBody testimonial={testimonial} />
                            </div>
                        )}
                    </GridItem>
                ))}
            </SimpleGrid>
        </div>
    )
}

export const TestimonialBody = ({ testimonial }: { testimonial: any }) => {
    return (
        <>
            <div
                className={`${testimonial.bgColorClass} absolute left-0 top-0 -z-1 h-full w-full rounded-3xl border-2 border-n-1 bg-white shadow-md ring-2 ring-white`}
            ></div>

            <img src={testimonial.imageSrc} alt={testimonial.altText} className="mx-auto h-20 w-20 rounded-full" />

            <div className="mt-4 text-center text-lg font-semibold leading-6">{testimonial.comment}</div>

            <div className="mt-4 text-center">
                <div className="font-semibold">
                    {testimonial.name}, {testimonial.detail}
                </div>
            </div>
        </>
    )
}
