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
    getInputValue() {
        if (this.keyCodeId.startsWith('Key')) {
            const base = this.keyCodeId.at(-1) ?? ''
            return this.isUpperCase() ? base.toUpperCase() : base.toLowerCase()
        }
        return ''
    }
    isUpperCase() {
        return this.e.getModifierState('CapsLock')
    }

    isAlt() {
        return isAlt(this.keyCodeId) || this.e.altKey
    }

    isCtrl() {
        return isCtrl(this.keyCodeId) || this.e.ctrlKey
    }

    isShift() {
        return isShift(this.keyCodeId) || this.e.shiftKey
    }

    isMeta() {
        return isMeta(this.keyCodeId)
    }
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
