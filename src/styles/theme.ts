import { extendTheme } from '@chakra-ui/react'
import * as consts from '@/constants'

const config = {
    initialColorMode: 'light' as 'light',
    useSystemColorMode: false,
}
const breakpoints = {
    xs: '22em',
    sm: '30em',
    md: '48em',
    lg: '62em',
    xl: '80em',
    '2xl': '96em',
}

export const theme = extendTheme({
    breakpoints,
    config,
})
