'use client'

import { Stack } from '@chakra-ui/react'
import * as assets from '@/assets'
import { AutoTextSize } from 'auto-text-size'

type MikeProps = {
    lines: Array<string>
}

export function Mike({ lines }: MikeProps) {
    return (
        <Stack className="relative overflow-x-hidden px-6 py-40 md:px-8 md:py-36">
            <img src={assets.Star.src} className="absolute left-0 top-[12%] w-14 md:left-[4%] lg:left-[10%]" />
            <img
                src={assets.SmileSide.src}
                className="absolute right-4 top-[14%] w-30 -rotate-[15deg] md:right-[4%] lg:right-[12%]"
            />
            <img
                src={assets.SmileStars.src}
                className="absolute -right-8 top-[4%] w-32 rotate-2 md:right-[1%] lg:right-[9%]"
            />

            {lines.map((line, index) => (
                <div
                    key={index}
                    className={`font-display text-violet-3 relative z-10 mx-auto w-4/5 max-w-4xl text-center uppercase leading-[0.825]`}
                >
                    <AutoTextSize maxFontSizePx={400}>{line}</AutoTextSize>
                </div>
            ))}
        </Stack>
    )
}
