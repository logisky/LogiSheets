import {ReadyState} from 'react-use-websocket'
import {transform} from './socket-status'
export const Waiting = ({status}: {status: ReadyState}) => {
    return <div>{transform(status)} waiting...</div>
}