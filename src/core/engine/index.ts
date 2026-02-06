/**
 * Engine singleton management
 * This replaces the old IoC container setup with logisheets-engine
 */

import {Engine} from 'logisheets-engine'
import type {EngineConfig} from 'logisheets-engine'

let _engine: Engine | null = null

/**
 * Initialize the global engine instance.
 * Call this once at app startup.
 */
export function initEngine(config?: Partial<EngineConfig>): Promise<Engine> {
    if (_engine) {
        // eslint-disable-next-line no-console
        console.warn('Engine already initialized')
        return Promise.resolve(_engine)
    }

    console.log('[LogiSheets] Creating engine...')
    _engine = new Engine(config)

    return new Promise((resolve) => {
        console.log('[LogiSheets] Waiting for ready event...')
        _engine!.on('ready', () => {
            console.log('[LogiSheets] Engine ready!')
            resolve(_engine!)
        })
    })
}

/**
 * Get the global engine instance.
 * Throws if engine is not initialized.
 */
export function getEngine(): Engine {
    if (!_engine) {
        throw new Error('Engine not initialized. Call initEngine() first.')
    }
    return _engine
}

/**
 * Check if engine is initialized.
 */
export function isEngineInitialized(): boolean {
    return _engine !== null
}

/**
 * Destroy the global engine instance.
 */
export function destroyEngine(): void {
    if (_engine) {
        _engine.destroy()
        _engine = null
    }
}

export {Engine}
export type {EngineConfig}
