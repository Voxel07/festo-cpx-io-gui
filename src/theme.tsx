import React, { useState, useMemo, useEffect } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'

import { ThemeContext } from './themeContext'
import type { ColorMode } from './themeContext'

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
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
                        main: '#0091DC', // Main color
                    },
                    secondary: {
                        main: '#C8E6FA',
                    },
                    text: {
                        primary: mode === 'light' ? '#000000' : '#ffffff',
                    },
                    background: {
                        default: mode === 'light' ? '#E5E8EB' : '#121212',
                        paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
                    },
                    info: {
                        main: '#B6B4C6',
                    }
                },
                components: {
                    MuiAppBar: {
                        styleOverrides: {
                            root: {
                                backgroundColor: mode === 'light' ? '#0091DC' : '#272727',
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
