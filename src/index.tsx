import React from 'react'
import ReactDOM from 'react-dom'
import './index.scss'
import App from './App'
import reportWebVitals from './reportWebVitals'
import {IocProvider} from '@/core/ioc/provider'
import {CONTAINER, setup} from '@/core/ioc/config'
import './core/i18n/i18n'

setup().then(() => {
    ReactDOM.render(
        <React.StrictMode>
            <IocProvider container={CONTAINER}>
                <App />
            </IocProvider>
        </React.StrictMode>,
        document.getElementById('root')
    )
})

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
