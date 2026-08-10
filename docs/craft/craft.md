# Craft

`Craft` is a core concept of `LogiSheets`. To be general, `craft` is
a small application that resides in the `LogiSheets` platform.
It allows users to perform custom operations on the data in the `LogiSheets` based on the craft's configuration.

Technically, a craft is a standalone package (built to a UMD bundle) loaded in a
same-origin `<iframe>` in the craft panel; the host injects a set of
capabilities onto the craft's `window` (read/write the sheet, listen to canvas
input, persist state, …).

➡️ **Ready to build one? See [Write your own craft](./writing-a-craft.md)** — a
step-by-step tutorial covering the host API, common patterns, and the gotchas
(color formats, transactions, sheet management, registration).
