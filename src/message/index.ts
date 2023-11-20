import {
    ActionEffect,
    DisplayRequest,
    DisplayResponse,
    Transaction,
} from '@logisheets_bg'
export type ClientRequest =
    | {$case: 'transaction'; transaction: Transaction}
    | {$case: 'history'; undo: boolean}
    | {$case: 'displayRequest'; displayRequest: DisplayRequest}
    | {$case: 'openFile'; openFile: OpenFile}

export interface OpenFile {
    name: string
    content: Uint8Array
}

export type ServerResponse =
    | {$case: 'displayResponse'; displayResponse: DisplayResponse}
    | {$case: 'actionEffect'; actionEffect: ActionEffect}

export interface OpenFile {
    fileId: string
    content: Uint8Array
    name: string
}
