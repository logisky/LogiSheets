import { Buttons } from "@/core"

export type ScrollbarType = 'x' | 'y'

export interface MouseEventInfo {
    startPosition: number
    startScrollDistance: number
}

export interface CustomScrollEvent {
    buttons: Buttons
}