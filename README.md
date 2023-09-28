# LogiSheets

[![MIT/Apache 2.0](https://img.shields.io/badge/license-MIT/Mit-blue.svg)](./LICENSE)

## What is LogiSheets?

LogiSheets is a web spreadsheet application that is compatible with Excel and designed for easy further development. Most important of all, it's free! And LogiSheets is written in Rust, and you are able to create, read and write .xlsx files.

This repo contains some our tools too, feel free and just make issues
or PRs about them!

## WARNING

LogiSheets is still in the **very** early stages of development. Your issues or PRs are welcome!

## Design goals

- **Easy further development**: LogiSheets provides rich APIs to help you develop your plugins.
- **Structural Data Support**: LogiSheets provides a data structure (temporary named _Block_) to ensure the relative positions of cells in a certain area keep unchanged.
- **Supporting Cowork**

## Get Started

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

### Use it as a web application

We are working on it. You can check the progress by running the cmd

```cmd
yarn start:wasm
```

## Featured

- Insert/delete columns or rows.
- Calculating and supporting 200+ functions.
- Undo/Redo

## LIMITATIONS

- Insert/delete cells.
