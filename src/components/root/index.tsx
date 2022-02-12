import { useEffect } from 'react'
import { SocketError } from './error'
import { Waiting } from './waiting'
import { RootContainer } from './container'
import useWebSocket, { ReadyState } from 'react-use-websocket'
import { DATA_SERVICE } from 'core/data'
import styles from './root.module.scss'
import { SETTINGS } from 'global/settings'


export const SpreadsheetRoot = () => {
    const wsUrl = SETTINGS.wsUrl
    const {
        sendMessage,
        readyState,
    } = useWebSocket(wsUrl, {
        shouldReconnect: e => e.isTrusted,
        reconnectInterval: 1000,
        onMessage: msg => {
            DATA_SERVICE.backend._handleResponse(msg.data)
        },
    });

    useEffect(() => {
        if (readyState !== ReadyState.OPEN)
            return
        sendMessage('join:minglong:4')
        const sub = DATA_SERVICE.backend.send$.subscribe(msg => {
            sendMessage(msg)
        })
        return () => {
            sub.unsubscribe()
        }
    }, [readyState])

    return (
        <div className={styles.host}>
            {readyState === (ReadyState.CONNECTING || ReadyState.CLOSING) ? <Waiting status={readyState}></Waiting> : null}
            {readyState === ReadyState.UNINSTANTIATED ? <SocketError></SocketError> : null}
            {readyState === ReadyState.OPEN ? <RootContainer></RootContainer> : null}
        </div>
    );
}
