/* eslint-disable @typescript-eslint/no-explicit-any */
import {injectable} from 'inversify'
import {Resp} from 'logisheets-web'
import {AppropriateHeight, Grid, OffscreenRenderName} from '../../worker/types'

@injectable()
export class OffscreenClient {
    public constructor(private _worker: Worker) {
        // Listen separately so we don't override WorkbookClient's onmessage
        this._worker.addEventListener('message', (e: MessageEvent) => {
            const data = e.data as {
                rid?: number
                result?: unknown
                error?: unknown
            }
            const rid = data?.rid
            if (typeof rid !== 'number') return
            const resolver = this._resolvers.get(rid)
            if (resolver) {
                resolver(data.error ?? data.result)
                this._resolvers.delete(rid)
            }
        })
    }

    init(canvas: OffscreenCanvas, dpr: number): Resp<void> {
        return this._call(
            OffscreenRenderName.Init,
            {
                canvas,
                dpr,
            },
            [canvas]
        ) as Resp<void>
    }

    render(sheetId: number, anchorX: number, anchorY: number): Resp<Grid> {
        return this._call(OffscreenRenderName.Render, {
            sheetId,
            anchorX,
            anchorY,
        }) as Resp<Grid>
    }

    getAppropriateHeights(
        sheetId: number,
        anchorX: number,
        anchorY: number
    ): Resp<readonly AppropriateHeight[]> {
        return this._call(OffscreenRenderName.GetAppropriateHeights, {
            sheetId,
            anchorX,
            anchorY,
        }) as Resp<readonly AppropriateHeight[]>
    }

    resize(width: number, height: number, dpr: number): Resp<Grid> {
        return this._call(OffscreenRenderName.Resize, {
            width,
            height,
            dpr,
        }) as Resp<Grid>
    }

    private _call(
        method: OffscreenRenderName,
        params?: any,
        transfer?: Transferable[]
    ) {
        const rid = this._rid++
        if (transfer) {
            this._worker.postMessage({m: method, args: params, rid}, transfer)
        } else {
            this._worker.postMessage({m: method, args: params, rid})
        }
        return new Promise((resolve) => {
            this._resolvers.set(rid, resolve)
        })
    }

    private _resolvers: Map<number, (arg: any) => unknown> = new Map()
    private _rid = 10
}
