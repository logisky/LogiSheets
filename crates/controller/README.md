# LogiSheets Controller

`Controller` is the core crate for LogiSheets.
`Controller` handles the user actions and returns the display information.

Here we will introduce some implementations.

## Important Components

- `Cell Id Manager` assigns Cell Id for every cell.
Cell Id identify a cell even this cell is removed.
Cell Id is not the cell position which would be changed when
inserting or removing some cells. 
You may find that we also use **Sheetid** to identify a worksheet,
and use **NameId** to identify a name. That's because in a spreadsheet
application, almost everything can be renamed or moved. Id Manager is
the foundation.

- `Container` stores the **CellId** and **Cell** map. You should visit the content
  of a cell by its **CellId**.

- `Navigator` is responsible for making convertion between cell id and
cell position. For now, LogiSheets do only support inserting or removing rows and columns,
we use a simple algo to make this convertion. 
`Navigator` stores a vector of **RowId** and a vector of **ColId**, and we use a tuple
(**RowId**, **ColId**) as a **CellId**. After a `navigator` of a sheet is initialized,
every row and column has an Id and therefore, every cell can be identified by (**RowId**, **ColId**). 
For example, when indexing a cell by position, like **B4** or r4c2, `Navigator` takes
the 4th **RowId** and 2nd **ColId**, and you can then get the **CellId**.
Users' inserting or removing rows/cols will do some effect on the **RowId** vector or **ColId** vector.

- `VertexManager` is responsible for recording the dependencies for calculating, updating
  the fomula ast and providing the dirty vertices and ast to `CalcEngine`.

- `Connectors` implements the traits and helps communicate between components.
  We use trait to make abstraction barrier between components, which helps to decouple
  them and makes easier to write unittests.

## Undo / Redo

We use [persistent data struct](https://en.wikipedia.org/wiki/Persistent_data_structure)
to store the state of a workbook, which helps us easyily implement an undo/redo system.

We use the [`im`](https://github.com/bodil/im-rs) crate to do this. It would be nice if
you have similar background to maintain this crate.
