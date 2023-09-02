import { BlurEvent } from "./events"

export interface TextContainerProps<T> {
    blur?: (e: BlurEvent<T>, text?: string) => void
    type?: (e: string) => void
}