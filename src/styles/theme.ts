import { extendTheme } from '@chakra-ui/react'
import { StepsTheme as Steps } from 'chakra-ui-steps'

const config = {
    initialColorMode: 'light' as 'light',
    useSystemColorMode: false,
}
/**
 * Breakpoints for responsive design.
 *
 * The breakpoints are defined in em units and their equivalent in pixels are:
 * - xs: 22em (352px)
 * - sm: 30em (480px)
 * - md: 48em (768px)
 * - lg: 62em (992px)
 * - xl: 80em (1280px)
 * - 2xl: 96em (1536px)
 */
export const breakpoints = {
    xs: '22em',
    sm: '30em',
    md: '48em',
    lg: '62em',
    xl: '80em',
    '2xl': '96em',
}

export const emToPx = (em: string) => parseFloat(em) * 16

export const theme = extendTheme({
    breakpoints,
    config,
    colors: {
        stepperScheme: {
            50: '#e1f5fe',
            100: '#b3e5fc',
            200: '#81d4fa',
            300: '#4fc3f7',
            400: '#29b6f6',
            500: '#03a9f4',
            600: '#039be5',
            700: '#0288d1',
            800: '#0277bd',
            900: '#01579b',
        },
        pink: {
            500: '#FF9CEA',
        },
    },

    components: {
        Steps,
    },
})
