/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {WorkerService} from './workbook.worker'
import {OffscreenWorkerImpl} from './offscreen.worker'

const ctx: Worker = self as any
// In a Web Worker there is no `window`. Create a compatibility alias so code
// that expects `window` can still run in the worker context.
;(self as any).window = self as any
self.window.devicePixelRatio = 1

// Worker thread execution
const workerService = new WorkerService(ctx)
const offscreenWorker = new OffscreenWorkerImpl(workerService, ctx)

// Queue workbook messages (id) until workerService.init() completes,
// but handle offscreen messages (rid) immediately so early init/render isn't lost.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pendingWorkbookMsgs: any[] = []

ctx.onmessage = (e) => {
    const request = e.data
    if (request && request.rid) {
        offscreenWorker.handleRequest(request)
    }
    if (request && request.id) {
        pendingWorkbookMsgs.push(request)
    }
}

workerService.init().then(() => {
    // Drain queued workbook messages
    for (const msg of pendingWorkbookMsgs) {
        workerService.handleRequest(msg)
    }
    pendingWorkbookMsgs.length = 0

    // Replace with normal handler once initialized
    ctx.onmessage = (e) => {
        const request = e.data
        if (request && request.id) {
            workerService.handleRequest(request)
        }
        if (request && request.rid) {
            offscreenWorker.handleRequest(request)
        }
    }
})
