# LogiSheets

[![MIT/Apache 2.0](https://img.shields.io/badge/license-MIT/Mit-blue.svg)](./LICENSE)

## What is LogiSheets?

LogiSheets is a web-based spreadsheet application that seamlessly integrates with Excel and is crafted for expansion. Notably, it comes at no cost!

You can utilize the Rust crate and Node package to efficiently read, perform operations, and write .xlsx files.

We are also working on a user interface to enable users to use spreadsheets directly in their web browsers.

## WARNING

LogiSheets is currently in its **early development** stages. We welcome your feedback, issues, or pull requests!

## Design goals

- **Easy further development**: LogiSheets provides rich APIs to help you develop your plugins.
- **Structural Data Support**: LogiSheets introduces a data structure (temporarily named Block) to maintain the consistent positions of cells within a specified area.
- **Supporting Cowork**

## Get Started

### Use it as a web application

We are working on it. You can check the progress [here](https://www.logisheets.com).

### Use it in Rust

Now, LogiSheets provides APIs to read and write a **.xlsx** file. More APIs to manipulate the spreadsheets(like input a formula and calculate or write a file) is on the way.

Load a file:

```rust
use logisheets::{Value, Workbook};
use std::fs;
let mut buf = fs::read("tests/6.xlsx").unwrap();
let mut wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
let mut ws = wb.get_sheet_by_idx(0).unwrap();
```

And then get a value:

```rust
let v = ws.get_value(9, 1).unwrap();
```

Or get a formula:

```rust
let f = ws.get_formula(9, 1).unwrap();
```

Also you can get a cell style:

```rust
let s = ws.get_style(9, 1).unwrap();
```

You can get the comments of a sheet by:

```rust
let comments = ws.get_comments();
```

## Featured

- Insert/delete columns or rows.
- Calculating and supporting 200+ functions.
- Undo/Redo

## LIMITATIONS

- Insert/delete cells.
