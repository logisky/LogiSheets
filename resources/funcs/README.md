# Function Signatures

Used in formula arguments check and intellisense.

## Spec

We use `JSON` to describe a function signature.
This `JSON` object has these fields:

- name: The function's name in upper case
- argCount: Valid count of args
- args: Describe properties of each argument.
- description

### argCount

`argCount` is an object having these fields:

- le: arg count must be less or equal than the value
- ge: arg count must be greater or equal than the value
- eq: arg count must be equal to the value
- odd: arg count must be odd
- even: arg count must be even


### args

`args` is a list of object. Each object has these fields:

- argName
- refOnly
    - type: Boolean
    - default: false
    - description: If this is true, it means this argument only accept **A1** or **A1:B2**, default false.
- startRepeated
    - type: Boolean
    - default: false
    - description: If this is true, it means that this argument and those after it makes a group that can be repeated for multiple times.
- description