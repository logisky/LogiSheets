---
description: Crafts are plugins that turn a LogiSheets spreadsheet into a real application — sandboxed mini-apps driven by the workbook's public API.
---

# Craft

`Craft` is a core concept of `LogiSheets`. To be general, `craft` is
a small application that resides in the `LogiSheets` platform.
It allows users to perform custom operations on the data in the `LogiSheets` based on the craft's configuration.

Technically, a craft is a standalone package loaded in a same-origin `<iframe>`
in the craft panel; the host injects a set of capabilities onto the craft's
`window` (read/write the sheet, listen to canvas input, persist state, …).

A craft can also expose **tools** to **Watson**, the built-in AI assistant: you
annotate your craft's functions and the [`craftsmith`](./craftsmith.md) CLI turns
them into a capability manifest Watson can discover and call. The same function
powers both your UI and the AI — no separate tool layer.

➡️ **Scaffold one with `craftsmith new`**, then:

- **[Write your own craft](./writing-a-craft.md)** — the host API, common
  patterns, and gotchas (color formats, transactions, sheet management).
- **[Give a craft AI tools](./craftsmith.md)** — annotate functions as tools for
  Watson, and build / publish with `craftsmith`.
