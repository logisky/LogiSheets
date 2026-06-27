/**
 * Main worker entry point.
 * Handles both workbook operations and offscreen rendering.
 */

import { WorkbookWorkerService } from "./workbook.worker";
import { OffscreenWorkerService } from "./offscreen.worker";

const ctx: Worker = self as unknown as Worker;

// In a Web Worker there is no `window`. Create a compatibility alias.
(self as any).window = self as any;
self.window.devicePixelRatio = 1;

// Initialize worker services
const workbookService = new WorkbookWorkerService(ctx);
const offscreenWorker = new OffscreenWorkerService(workbookService, ctx);

// Queue workbook messages until workbookService.init() completes,
// but handle offscreen messages immediately so early init/render isn't lost.
const pendingWorkbookMsgs: any[] = [];

ctx.onmessage = (e) => {
  const request = e.data;
  if (request && request.rid !== undefined) {
    offscreenWorker.handleRequest(request);
  }
  if (request && request.id !== undefined) {
    pendingWorkbookMsgs.push(request);
  }
};

workbookService.init().then(() => {
  // Drain queued workbook messages
  for (const msg of pendingWorkbookMsgs) {
    workbookService.handleRequest(msg);
  }
  pendingWorkbookMsgs.length = 0;

  // Replace with normal handler once initialized
  ctx.onmessage = (e) => {
    const request = e.data;
    if (request && request.id !== undefined) {
      workbookService.handleRequest(request);
    }
    if (request && request.rid !== undefined) {
      offscreenWorker.handleRequest(request);
    }
  };
});
