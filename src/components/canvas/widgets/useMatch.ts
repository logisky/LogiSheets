import {match} from '../defs'
import {ViewRange} from '@/core/data'
import {RefObject} from 'react'
export const useMatch = (canvas: RefObject<HTMLCanvasElement>) => {
    const _match = (clientX: number, clientY: number, viewRange: ViewRange) => {
        if (!canvas.current) return
        return match(clientX, clientY, canvas.current, viewRange)
    }
    return {
        match: _match,
    }
}
