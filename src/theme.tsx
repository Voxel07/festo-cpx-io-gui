import React, { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'

export type ColorMode = 'light' | 'dark'

interface ThemeContextType {
    mode: ColorMode
    toggleColorMode: () => void
}

const ThemeContext = createContext<ThemeContextType>({
    mode: 'light',
    toggleColorMode: () => { },
})

export const useColorMode = () => useContext(ThemeContext)

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
    // Check local storage or system preference
    const [mode, setMode] = useState<ColorMode>(() => {
        const savedMode = localStorage.getItem('theme-mode')
        if (savedMode === 'light' || savedMode === 'dark') {
            return savedMode
        }
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark'
        }
        return 'light'
    })

    useEffect(() => {
        localStorage.setItem('theme-mode', mode)
    }, [mode])

    const colorMode = useMemo(
        () => ({
            mode,
            toggleColorMode: () => {
                setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'))
            },
        }),
        [mode]
    )

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    primary: {
                        main: '#00afff', // User requested main color
                    },
                    secondary: {
                        main: '#00A0E1',
                    },
                    background: {
                        default: mode === 'light' ? '#f5f5f5' : '#121212',
                        paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
                    },
                },
                components: {
                    MuiAppBar: {
                        styleOverrides: {
                            root: {
                                backgroundColor: mode === 'light' ? '#003366' : '#272727',
                            }
                        }
                    }
                }
            }),
        [mode]
    )

    return (
        <ThemeContext.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeContext.Provider>
    )
}
