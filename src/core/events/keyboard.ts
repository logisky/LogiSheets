import {KeyboardEventCode, extractKeyCode} from './key_code'
export const enum KeyMod {
    CTRL_CMD = (1 << 11) >>> 0,
    SHIFT = (1 << 10) >>> 0,
    ALT = (1 << 9) >>> 0,
    WIN_CTRL = (1 << 8) >>> 0,
}

export class StandardKeyboardEvent {
    constructor(public readonly e: KeyboardEvent) {
        this.isComposing = e.isComposing
        this.keyCodeId = extractKeyCode(e)
        this.isKeyBinding = isKeyBinding(this.keyCodeId)
    }
    keyCodeId: KeyboardEventCode
    isKeyBinding: boolean
    isComposing: boolean

    isAlt() {
        return isAlt(this.keyCodeId)
    }

    isCtrl() {
        return isCtrl(this.keyCodeId)
    }

    isShift() {
        return isShift(this.keyCodeId)
    }

    isMeta() {
        return isMeta(this.keyCodeId)
    }
    // private _computeKeyBinding() {
    //     let key = KeyboardEventCode.UNKNOWN
    //     if (!isKeyBinding(this.keyCodeId))
    //         key = this.keyCodeId
    //     let result = 0
    //     if (this.e.ctrlKey)
    //         result |= isMac() ? KeyMod.WIN_CTRL : KeyMod.CTRL_CMD
    //     if (this.e.altKey)
    //         result |= KeyMod.ALT
    //     if (this.e.shiftKey)
    //         result |= KeyMod.SHIFT
    //     if (this.e.metaKey)
    //         result |= isMac() ? KeyMod.CTRL_CMD : KeyMod.WIN_CTRL
    //     result |= key
    //     return result
    // }
}
function isKeyBinding(id: KeyboardEventCode) {
    return isCtrl(id) || isShift(id) || isAlt(id) || isMeta(id)
}

function isCtrl(id: KeyboardEventCode) {
    return (
        id === KeyboardEventCode.CONTROL_LEFT ||
        id === KeyboardEventCode.CONTROL_RIGHT
    )
}

function isShift(id: KeyboardEventCode) {
    return (
        id === KeyboardEventCode.SHIFT_LEFT ||
        id === KeyboardEventCode.SHIFT_RIGHT
    )
}

function isAlt(id: KeyboardEventCode) {
    return (
        id === KeyboardEventCode.ALT_LEFT || id === KeyboardEventCode.ALT_RIGHT
    )
}

function isMeta(id: KeyboardEventCode) {
    return (
        id === KeyboardEventCode.METALEFT || id === KeyboardEventCode.META_RIGHT
    )
}
