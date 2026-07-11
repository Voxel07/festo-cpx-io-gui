import { createContext, useContext } from 'react'

export interface ModuleIoState {
    inputs: boolean[]
    outputs: boolean[]
    inouts: boolean[]
}

export type AllIoStates = Record<number, ModuleIoState>

export const IoStateContext = createContext<AllIoStates>({})

export function useLiveIoState() {
    return useContext(IoStateContext)
}
