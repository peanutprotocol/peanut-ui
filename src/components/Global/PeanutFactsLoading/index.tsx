'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { PeanutGuyGIF } from '@/assets/illustrations'
import Card from '@/components/Global/Card'

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
    const [currentFactIndex, setCurrentFactIndex] = useState(0)

    useEffect(() => {
        // Rotate facts every 4 seconds
        const interval = setInterval(() => {
            setCurrentFactIndex((prevIndex) => (prevIndex + 1) % PEANUT_FACTS.length)
        }, 4000)

        return () => clearInterval(interval)
    }, [])

    return (
        <div className="flex min-h-[inherit] flex-col items-center justify-center gap-6 p-6">
            <div className="flex flex-col items-center gap-4">
                <Image src={PeanutGuyGIF} alt="Peanut Guy" width={200} height={200} className="h-48 w-48" priority />
                <p className="text-lg font-semibold text-gray-900">{message}</p>
            </div>

            <Card className="w-full max-w-md p-6">
                <div className="flex flex-col gap-3">
                    <p className="text-sm font-bold text-gray-900">Did you know?</p>
                    <p className="min-h-[4rem] text-sm text-gray-700 transition-opacity duration-300">
                        {PEANUT_FACTS[currentFactIndex]}
                    </p>
                </div>
            </Card>
        </div>
    )
}
