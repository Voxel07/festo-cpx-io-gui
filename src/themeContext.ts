import { createContext, useContext } from 'react'

export type ColorMode = 'light' | 'dark'

export interface ThemeContextType {
    mode: ColorMode
    toggleColorMode: () => void
}

export const ThemeContext = createContext<ThemeContextType>({
    mode: 'light',
    toggleColorMode: () => { },
})

export const useColorMode = () => useContext(ThemeContext)
