import React from 'react'
import {createRoot} from 'react-dom/client'
import './index.scss'
import App from './App'
import reportWebVitals from './reportWebVitals'
import {IocProvider} from '@/core/ioc/provider'
import {CONTAINER, setup} from '@/core/ioc/config'
import './core/i18n/i18n'

setup().then(() => {
    const root = createRoot(document.getElementById('root') as HTMLElement)

    root.render(
        <React.StrictMode>
            <IocProvider container={CONTAINER}>
                <App />
            </IocProvider>
        </React.StrictMode>
    )
})

reportWebVitals()
