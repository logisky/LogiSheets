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
