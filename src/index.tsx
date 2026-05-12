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
import './core/i18n/i18n'
import 'logisheets-engine/style.css'

initEngine().then(async (engine) => {
    // Activate license to remove watermark
    // API KEY is read from environment variable for security
    const apiKey = process.env.LOGISHEETS_API_KEY
    if (apiKey) {
        await engine.setLicense(apiKey)
    }

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
