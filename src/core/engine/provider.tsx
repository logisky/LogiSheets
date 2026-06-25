/**
 * Engine React Context Provider
 * Provides engine access throughout the React component tree
 */

import {createContext, useContext, FC, ReactNode, useMemo} from 'react'
import {Engine} from 'logisheets-engine'
import {WorkbookOps} from 'logisheets-core'
import {globalStore} from '@/store'

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

/**
 * Hook to access the engine-neutral operation layer (logisheets-core).
 *
 * High-level workbook operations live in WorkbookOps so they are shared with
 * the Node runtime; the browser just injects its worker-backed client here.
 */
export function useOps(): WorkbookOps {
    const engine = useEngine()
    return useMemo(
        () =>
            new WorkbookOps(
                engine.getWorkbook(),
                () => globalStore.isTempMode
            ),
        [engine]
    )
}
