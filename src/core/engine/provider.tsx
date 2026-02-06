/**
 * Engine React Context Provider
 * Provides engine access throughout the React component tree
 */

import {createContext, useContext, FC, ReactNode} from 'react'
import {Engine} from 'logisheets-engine'

interface EngineContextValue {
    engine: Engine
}

const EngineContext = createContext<EngineContextValue | null>(null)

interface EngineProviderProps {
    engine: Engine
    children: ReactNode
}

/**
 * Provides the Engine instance to all child components
 */
export const EngineProvider: FC<EngineProviderProps> = ({engine, children}) => {
    return (
        <EngineContext.Provider value={{engine}}>
            {children}
        </EngineContext.Provider>
    )
}

/**
 * Hook to access the Engine instance
 */
export function useEngine(): Engine {
    const context = useContext(EngineContext)
    if (!context) {
        throw new Error('useEngine must be used within an EngineProvider')
    }
    return context.engine
}

/**
 * Hook to access the Workbook client (original logisheets-web API)
 */
export function useWorkbook() {
    const engine = useEngine()
    return engine.getWorkbook()
}

/**
 * Hook to access the DataService
 */
export function useDataService() {
    const engine = useEngine()
    return engine.getDataService()
}

/**
 * Hook to access the BlockManager
 */
export function useBlockManager() {
    const engine = useEngine()
    return engine.getBlockManager()
}
