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

### CHECKNUM

Check whether the cell is equal to a given number.

```ls
CHECKNUM A1 3
```

### CHECKSTR

Check whether the cell is equal to a string.

```ls
CHECKSTR A1 aaa
```

### CHECKERROR

Check whether the cell is equal to an error.

```ls
CHECKERROR A1 #NUM!
```
