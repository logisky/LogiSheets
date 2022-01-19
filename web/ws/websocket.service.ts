import {Subject, ReplaySubject, Observable, from} from 'rxjs'
import {Injectable} from '@angular/core'
import {
    DisplayResponse,
    assertIsServerSend,
    SheetUpdated,
    ServerSendBuilder,
    isSheetUpdated,
    isDisplayResponse,
} from '@logi-pb/network/src/proto/message_pb'
import {debugWeb} from '@logi-sheets/web/global'
const URL = 'ws://localhost:8081/ws/'
type WsType = string | Blob | ArrayBufferLike | ArrayBufferView

@Injectable()
export class WebSocketService {
    constructor() {
        this._handle()
    }
    onDestroy(): void {
        this._ws.close()
        this._response$.complete()
    }

    send(message: WsType): void {
        this._sendMessage$.next(message)
    }

    open$(): Observable<boolean> {
        return this._openSuccess$
    }

    handleMsg$(): Observable<unknown> {
        return this._response$
    }

    displayResponse$(): Observable<DisplayResponse> {
        return this._displayResponse$
    }

    sheetUpdated$(): Observable<SheetUpdated> {
        return this._sheetUpdated$
    }
    private _displayResponse$ = new Subject<DisplayResponse>()
    private _sheetUpdated$ = new Subject<SheetUpdated>()
    private _openSuccess$ = new ReplaySubject<boolean>(1)
    private _response$ = new Subject<unknown>()
    private _sendMessage$ = new Subject<WsType>()
    private _ws = new WebSocket(URL)
    private _handle(): void {
        this._sendMessage$.subscribe(msg => {
            this._ws.send(msg)
        })
        this._ws.addEventListener('close', this._handleComplete.bind(this))
        this._ws.addEventListener('error', this._handleError.bind(this))
        this._ws.addEventListener('message', this._handleMessage.bind(this))
        this._ws.addEventListener('open', this._handleOpen.bind(this))
    }

    private _join(): void {
        this._ws.send('join:minglong:4')
    }

    private _handleOpen(): void {
        debugWeb('ws open success')
        this._openSuccess$.next(true)
        this._join()
    }

    private _handleMessage(msg: MessageEvent) {
        // tslint:disable-next-line: no-type-assertion
        from((msg.data as Blob).arrayBuffer()).subscribe(ab => {
            const data = new ServerSendBuilder()
                .decode(new Uint8Array(ab))
                .build()
            assertIsServerSend(data)
            const serverSend = data.getServerSendOneof()
            if (serverSend === undefined)
                return
            debugWeb('server send ', data)
            const type = serverSend[0]
            if (isDisplayResponse(type) && data.displayResponse)
                this._displayResponse$.next(data.displayResponse)
            else if (isSheetUpdated(type) && data.sheetUpdated)
                this._sheetUpdated$.next(data.sheetUpdated)
        })
    }

    private _handleError(msg: unknown): void {
        debugWeb('ws, handle error', msg)
        this._openSuccess$.next(false)
    }

    private _handleComplete(): void {
        debugWeb('ws, handle complete')
    }
}
