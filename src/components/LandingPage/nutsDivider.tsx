'use client'

import { Box } from '@chakra-ui/react'
import { PeanutsBG } from '@/assets'

type DividerProps = {
    height?: string
    className?: string
}

export function NutsDivider({ height = 'h-[10vw] md:h-[7vw]', className }: DividerProps) {
    const inlineStyle = {
        backgroundImage: `url(${PeanutsBG.src})`,
        backgroundSize: '8rem auto',
        backgroundRepeat: 'repeat',
    }

    const boxClass = `${height} grow border-4 border-n-1 bg-primary ring-2 ring-white shadow-md`

    return <Box className={`${boxClass} ${className}`} style={inlineStyle}></Box>
}
