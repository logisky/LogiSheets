import React from 'react'
import {createRoot} from 'react-dom/client'
import './index.scss'
// Permission patch must be imported BEFORE the engine is initialized
// so that WorkbookClient.prototype is wrapped before any instance is created.
import '@/core/permissions/patch'
import App from './App'
import reportWebVitals from './reportWebVitals'
import {EngineProvider} from '@/core/engine/provider'
import {initEngine} from '@/core/engine'
import {installCraftStorageBackend} from '@/core/craft-storage'
import './core/i18n/i18n'
import 'logisheets-engine/style.css'

// Pick the device-scoped craft-storage backend (localStorage / Tauri app-data)
// before any craft iframe can mount.
installCraftStorageBackend()

initEngine().then(async (engine) => {
    const root = createRoot(document.getElementById('root') as HTMLElement)

    root.render(
        <React.StrictMode>
            <EngineProvider engine={engine}>
                <App />
            </EngineProvider>
        </React.StrictMode>
    )
})

reportWebVitals()
