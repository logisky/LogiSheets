# Compile the LogiSheets as a wasm-app

This crate aims to compile `controller` in a wasm file that is used in web.

## Interface with JS

This is the most hard part in this project.

In the `network` crate, we use protobuf to define the interface.
There are 2 merits using this way:

- encrypt the protocol from users to prevent the protocols from abuse by users.
- make the message smaller to deliver

In a wasm app, we do not need to worry about the network bindwidth and the
protocols will be encrypted by js bundler automatically.

What's more, `wasm-bindgen` only support C-style enums currently, the interface
we defined in `network` is imposible to migrate here directly.

### Plans

- Plan A: write the interface from zero.We use this right now.
- Plan B: using protobuf and encode/decode message before delivering.

## Build the wasm

```shell
wasm-pack build
```

Check in `./pkg`.
