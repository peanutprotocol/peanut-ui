// No-op ThemeProvider retained for backward compat with existing layouts.
// The MUI ThemeProvider was only serving MUI components; after the Lucide
// migration there are no MUI consumers left, so this can be deleted in a
// follow-up once the 3 layout call sites drop the <ThemeProvider> wrapper.
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>
}
