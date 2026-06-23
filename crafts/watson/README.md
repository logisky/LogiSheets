# watson

The in-app AI assistant for LogiSheets.

Watson is a thin UI shell over the [`logician`](../../packages/logician) agent
toolkit: it provides the chat interface and the browser host adapters (LLM
transport, conversation storage, craft-interaction bridge), while `logician`
supplies the workbook-operating tools and agent loop. The same agent core runs
headless on Node — Watson is the browser face of it.

## Build

```bash
yarn workspace watson build   # bundles + copies to public/
```
