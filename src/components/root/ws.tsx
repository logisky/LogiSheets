import { useEffect, FC } from 'react'
import { SocketError } from './error'
import { Waiting } from './waiting'
import { RootContainer } from './container'
import useWebSocket, { ReadyState } from 'react-use-websocket'
import styles from './root.module.scss'
import { SETTINGS } from '@/common/settings'
import { Backend } from '@/core/data'
import { useInjection } from '@/core/ioc/provider'
import { TYPES } from '@/core/ioc/types'


export const WsCommponent = () => {
    const BACKEND_SERVICE = useInjection<Backend>(TYPES.Backend)
	const wsUrl = SETTINGS.wsUrl
	const {
		sendMessage,
		readyState,
	} = useWebSocket(wsUrl, {
		shouldReconnect: e => e.isTrusted,
		reconnectInterval: 1000,
		onMessage: msg => {
			if (!(msg.data instanceof Blob))
				return
			// @ts-expect-error TODO(minglong): remove this file
			BACKEND_SERVICE.handleResponse(msg.data)
		},
	});

	useEffect(() => {
		if (readyState !== ReadyState.OPEN)
			return
		sendMessage('join:minglong:4')
		const sub = BACKEND_SERVICE.send$.subscribe(msg => {
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

