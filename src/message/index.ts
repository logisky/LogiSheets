import {
    ActionEffect,
    DisplayRequest,
    DisplayResponse,
    EditAction,
} from '../bindings'
export type ClientRequest =
    | {$case: 'transaction'; transaction: EditAction}
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
