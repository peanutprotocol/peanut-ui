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
    fonts: {
        body: 'Times New Roman, sans-serif',
    },
    colors: {
        primary: {
            100: '#E5FCF1',
            200: '#27EF96',
            300: '#10DE82',
            400: '#0EBE6F',
            500: '#0CA25F',
            600: '#0A864F',
            700: '#086F42',
            800: '#075C37',
            900: '#064C2E',
        },
    },

    components: {
        Button: {
            baseStyle: {
                fontWeight: 600,
                fontSize: '18px',
                borderRadius: '5px',
                width: '175px',
                _hover: {
                    transform: 'scale(1.02)',
                    opacity: 0.95,
                },
            },
            variants: {
                primary: {
                    backgroundColor: 'brand.200',
                    color: 'white',

                    _hover: {
                        backgroundColor: 'brand.200 !important',
                        color: 'white !important',
                        transform: 'scale(1.02)',
                        opacity: 0.95,
                    },
                },
                secondary: {
                    border: '1px solid #192A5F',
                    color: 'black',
                    _hover: {
                        transform: 'scale(1.02)',
                        opacity: 0.95,
                    },
                },
            },
        },
    },

    styles: {
        global: {
            body: {
                color: 'black',
            },
        },
    },
})
