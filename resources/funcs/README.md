# Function Signatures

Used for formula argument validation and IntelliSense.

## Specification

We use `JSON` format to describe a function signature. The `JSON` object includes the following fields:

- **name**: The function's name in uppercase.
- **argCount**: Constraints on the number of arguments.
- **args**: Describes the properties of each argument.
- **description**: A description of the function.

### argCount

`argCount` is an object that defines constraints on the number of arguments. It includes the following fields:

- **le**: The argument count must be less than or equal to this value.
- **ge**: The argument count must be greater than or equal to this value.
- **eq**: The argument count must be equal to this value.
- **odd**: The argument count must be odd.
- **even**: The argument count must be even.

### args

`args` is a list of objects, each describing an argument's properties. Each object includes the following fields:

- **argName**: The name of the argument.
- **refOnly**:
  - **type**: Boolean.
  - **default**: `false`.
  - **description**: If `true`, this argument only accepts references like **A1** or **A1:B2**. Default is `false`.
- **startRepeated**:
  - **type**: Boolean.
  - **default**: `false`.
  - **description**: If `true`, this argument and subsequent ones form a group that can be repeated multiple times.
- **description**: A description of the argument.
