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
import {initCraftRegistry} from '@/core/craft-packages'
import {autoInstallCrafts} from '@/core/craft-packages/auto-install'
import './core/i18n/i18n'
import 'logisheets-engine/style.css'

// Pick the device-scoped craft-storage backend (localStorage / Tauri app-data)
// before any craft iframe can mount.
installCraftStorageBackend()

// The craft list (bundled + installed) is fixed before anything renders;
// installing or uninstalling a craft takes effect on the next reload. On the
// first online start, the distribution's registry crafts are installed first
// so they are already in that list.
Promise.all([initEngine(), autoInstallCrafts().then(initCraftRegistry)]).then(
    async ([engine]) => {
        const root = createRoot(document.getElementById('root') as HTMLElement)

        root.render(
            <React.StrictMode>
                <EngineProvider engine={engine}>
                    <App />
                </EngineProvider>
            </React.StrictMode>
        )
    }
)

reportWebVitals()
