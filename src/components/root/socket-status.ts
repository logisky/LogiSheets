import {ReadyState} from 'react-use-websocket'

export const transform = (readyState: ReadyState) => {
    const map = new Map<ReadyState, string>([
        [ReadyState.CLOSED, 'socket closed'],
        [ReadyState.CLOSING, 'socket closing'],
        [ReadyState.CONNECTING, 'socket connecting'],
        [ReadyState.OPEN, 'socket open'],
        [ReadyState.UNINSTANTIATED, 'socket uninstantiated'],
    ])
    return map.get(readyState) ?? ''
}