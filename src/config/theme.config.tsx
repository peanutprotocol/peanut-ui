'use client'

import { theme } from '@/styles/theme'
import { ColorModeScript, ColorModeProvider } from '@chakra-ui/color-mode'
import { ChakraProvider } from '@chakra-ui/react'

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    return (
        <ColorModeProvider>
            <ColorModeScript initialColorMode="light" key="chakra-ui-no-flash" storageKey="chakra-ui-color-mode" />
            <ChakraProvider theme={theme}>{children}</ChakraProvider>
        </ColorModeProvider>
    )
}

export default ThemeProvider
