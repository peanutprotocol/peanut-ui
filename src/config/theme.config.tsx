'use client'

import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles'

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    return <MuiThemeProvider theme={createTheme()}>{children}</MuiThemeProvider>
}
