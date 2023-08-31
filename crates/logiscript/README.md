# LogiScript

A script for testing the calculation of LogiSheets.

## Usage

### SWITCH

Switch to the specific sheet. If this sheet does not exist, create it.

```ls
SWITCH sheet
```

### INPUT

Take the content as the input to a cell.

```ls
INPUT A1 =SUM(1+2)
INPUT B2 3
```

### INSERTROW

Insert rows at the given position.

```ls
# Insert 3 rows at the row 1.
INSERTROW 1 3
```

### INSERTCOL

Insert cols at the given position.

```ls
# Insert 3 cols at the col B.
INSERTROW B 3
```

### DELETEROW

Delete rows at the given position.

```ls
# Delete 3 rows at the row 1.
DELETEROW 1 3
```

### DELETECOL

Delete cols at the given position.

```ls
# Delete 3 cols at the col B.
DELETECOL B 3
```

### BLOCKCREATE

Create a block with the given id and range.

```ls
BLOCKCREATE  1   A1:C3
```

### BLOCKREMOVE

Remove a block with given id.

```ls
BLOCKREMOVE 1
```

### BLOCKMOVE

Move a block by specifying new position of its master cell.

```ls
BLOCKMOVE 1  D4
```

### BLOCKINSERTROW

Insert some rows in a block.

```ls
BLOCKINSERTROW {block_id}  {idx}  {cnt}
```

### BLOCKINSERTCOL

Insert some cols in a block.

```ls
BLOCKINSERTCOL {block_id}  {idx}  {cnt}
```

### BLOCKDELETEROW

Delete som rows in a block.

```ls
BLOCKDELETEROW  {block_id}  {idx}  {cnt}
```

### BLOCKDELETECOL

Delete some cols in a block.

```ls
BLOCKDELTECOL {block_id}  {idx}  {cnt}
```

### CHECKNUM

Check whether the cell is equal to a given number.

```ls
CHECKNUM A1 3
```

### CHECKSTR

Check whether the value of a specific cell is equal to a string.

```ls
CHECKSTR A1 aaa
```

### CHECKERROR

Check whether the value of a specific cell is equal to an error.

```ls
CHECKERROR A1 #NUM!
```

### CHECKFORMULA

Check the formula of a cell.

```ls
CHECKFORMULA A1 SUM(1, 2)
```
