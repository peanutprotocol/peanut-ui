'use client'

import { useState } from 'react'
import Image from 'next/image'
import { PeanutGuyGIF } from '@/assets/illustrations'
import Card from '../Card'
import PeanutLoading from '../PeanutLoading'

const PEANUT_FACTS = [
    "Peanuts aren't nuts—they're legumes! They're basically fancy beans pretending to be nuts.",
    'It takes about 540 peanuts to make a 12-ounce jar of peanut butter.',
    'Peanuts grow underground, making them the introverts of the nut world.',
    "Astronauts eat peanuts in space because they're the perfect protein-packed snack.",
    "The world's largest peanut was 4 inches long. An absolute unit.",
    'Peanuts are one of the ingredients in dynamite (through the oil—glycerol).',
    'A peanut plant produces about 40 peanuts per plant. Efficient little guys.',
    'Arachibutyrophobia is the fear of peanut butter sticking to the roof of your mouth. Yes, really.',
    'Peanuts can be used to make everything from soap to shaving cream. Versatile kings.',
    "China and India produce over 60% of the world's peanuts. Peanut powerhouses!",
    'Peanut butter was invented as a protein substitute for people with bad teeth.',
    'The peanut shell is actually a pod, just like peas. Legume logic.',
    'Two-thirds of all peanuts grown are used to make peanut butter and peanut snacks.',
    'Peanuts are a great source of protein—about 7 grams per ounce.',
    'Wild peanuts still grow in South America, where they originally came from.',
    'Boiled peanuts are a popular snack in many countries. Soft, salty, and delicious.',
    'Peanuts can improve soil quality by adding nitrogen. Environmental heroes!',
]

interface PeanutFactsLoadingProps {
    message?: string
}

export default function PeanutFactsLoading({ message = 'Processing...' }: PeanutFactsLoadingProps) {
    // pick a random fact once when component mounts
    const [currentFactIndex] = useState(() => Math.floor(Math.random() * PEANUT_FACTS.length))

    return (
        <div className=" flex min-h-[inherit] flex-col items-center justify-center gap-6 p-6">
            <div className="relative mt-28 items-center rounded-none">
                <Card className="shadow-4 relative z-10 space-y-2 p-4">
                    <p className="text-xs font-bold text-gray-900">Did you know?</p>
                    <p className="text-sm text-gray-700 transition-opacity duration-300">
                        {PEANUT_FACTS[currentFactIndex]}
                    </p>
                </Card>

                {/* Peanutman with beer character at the top */}
                <div
                    className="absolute left-0 top-0 flex w-full justify-center"
                    style={{ transform: 'translateY(-60%)' }}
                >
                    <div className="relative h-42 w-[90%] md:h-52">
                        <Image src={PeanutGuyGIF} alt="Peanut Man" layout="fill" objectFit="contain" />
                    </div>
                </div>

                <div className="flex items-center justify-center gap-2 pt-6">
                    <div>
                        <PeanutLoading />
                    </div>
                    <p className="text-center text-sm font-semibold text-gray-900"> {message} </p>
                </div>
            </div>
        </div>
    )
}
