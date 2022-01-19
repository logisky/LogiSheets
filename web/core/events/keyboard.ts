import {
    getIdForCode,
    KeyboardEventCode,
    KeyCodeId,
} from '@logi-base/src/ts/common/key_code'
import {isMac} from '@logi-sheets/web/global/platform'

function extractKeyCode(e: KeyboardEvent): KeyCodeId {
    return getIdForCode(<KeyboardEventCode>e.code)
}
export class StandardKeyboardEvent {
    constructor(public readonly e: KeyboardEvent) {
        this.keyCodeId = extractKeyCode(e)
        this.isKeyBinding = isKeyBinding(this.keyCodeId)
        this._asKeybinding = this._computeKeyBinding()
    }
    keyCodeId: KeyCodeId
    isKeyBinding: boolean
    equals(other: number): boolean {
        return this._asKeybinding === other
    }

    isAlt(): boolean {
        return isAlt(this.keyCodeId)
    }

    isCtrl(): boolean {
        return isCtrl(this.keyCodeId)
    }

    isShift(): boolean {
        return isShift(this.keyCodeId)
    }

    isMeta(): boolean {
        return isMeta(this.keyCodeId)
    }
    private _asKeybinding: number
    private _computeKeyBinding(): number {
        let key = KeyCodeId.UNKNOWN
        if (!isKeyBinding(this.keyCodeId))
            key = this.keyCodeId
        let result = 0
        if (this.e.ctrlKey)
            result |= isMac() ? KeyMod.WIN_CTRL : KeyMod.CTRL_CMD
        if (this.e.altKey)
            result |= KeyMod.ALT
        if (this.e.shiftKey)
            result |= KeyMod.SHIFT
        if (this.e.metaKey)
            result |= isMac() ? KeyMod.CTRL_CMD : KeyMod.WIN_CTRL
        result |= key
        return result
    }
}
function isKeyBinding(id: KeyCodeId): boolean {
    return isCtrl(id) || isShift(id) || isAlt(id) || isMeta(id)
}

function isCtrl(id: KeyCodeId): boolean {
    return id === KeyCodeId.LEFTCTRL || id === KeyCodeId.RIGHTCTRL
}

function isShift(id: KeyCodeId): boolean {
    return id === KeyCodeId.LEFTSHIFT || id === KeyCodeId.RIGHTSHIFT
}

function isAlt(id: KeyCodeId): boolean {
    return id === KeyCodeId.LEFTALT || id === KeyCodeId.RIGHTALT
}

function isMeta(id: KeyCodeId): boolean {
    return id === KeyCodeId.LEFTMETA || id === KeyCodeId.RIGHTMETA
}
export const enum KeyMod {
    CTRL_CMD = (1 << 11) >>> 0,
    SHIFT = (1 << 10) >>> 0,
    ALT = (1 << 9) >>> 0,
    WIN_CTRL = (1 << 8) >>> 0,
}
