# LogiSheets — 项目开发者文档

## 项目概述

**LogiSheets** 是一个基于 Web 的电子表格应用，能够读取、编辑和写入真实的 `.xlsx`（Microsoft Excel）文件。它不仅是一个传统电子表格，还具备以下特色：

- **结构化数据（Blocks）**：带有 Schema 类型定义、校验、唯一性约束的表格区域，支持稳定 ID（插入/删除行不会破坏引用）。
- **插件系统（Crafts）**：独立的迷你应用，可以将电子表格扩展为应用平台。例如：工厂模拟游戏、AI 助手、情景计算器、Markdown 表格提取器等。
- **AI 原生能力**：`logician` 是一个 AI agent 工具包，支撑内置的 AI 助手 `watson` 通过结构化工具操作工作簿。
- **跨平台引擎**：核心引擎由 Rust 编写，编译为 WebAssembly，在浏览器和 Node.js 中完全一致运行。

Slogan：**"From sheets to systems."**

> **Blockchain ZK 转型目标**：将 LogiSheets 升级为区块链原生、基于零知识证明的金融电子表格平台。金融公式作为 commitment 上链，每季度输入数据后生成 ZK Proof 证明投资回报率等结果，链上可验证、公式支持增删改。


---

## 技术栈

| 层级 | 技术 |
|------|------|
| 核心引擎 | **Rust**（edition 2024），通过 `wasm-pack` 编译为 WebAssembly |
| 前端框架 | **React 19**（TypeScript） |
| 引擎 UI 组件 | **Svelte 5**（`logisheets-engine` 是基于 Svelte 的 Canvas 渲染器） |
| 状态管理 | **MobX 6**（`mobx` + `mobx-react`） |
| UI 库 | **MUI v6** + `@emotion` |
| 响应式扩展 | **RxJS 7** |
| 公式编辑器 | **CodeMirror 6**（`logisheets-formula-editor` 包） |
| 构建工具（浏览器） | **Webpack 5**（esbuild-loader） |
| 构建工具（引擎） | **Vite 6** |
| Rust 打包 | `wasm-pack`，target `--target web` |
| 语言 | **TypeScript 5.7** |
| 测试 | **Vitest**（单元）、**Playwright**（端到端）、**Jest**（遗留） |
| 文档 | **VitePress** |
| 包管理 | **Yarn 4.5**（workspaces） |
| 代码规范 | **ESLint**、**Prettier**、**Husky**、**lint-staged** |
| Rust 工具链 | Rust 1.95.0、`rustfmt`、`clippy` |
| 部署 | **Vercel** |
| ZK 证明 | **RiscZero zkVM** + Groth16 wrapping |
| 链上合约 | **Solidity**（Foundry 工具链）|
| 公式承诺 | Sparse Merkle Tree（当前 SHA-256，生产建议 Poseidon）|
| 链平台 | EVM 兼容链（Ethereum / L2）|

---

## 项目结构

```
LogiSheets/
├── src/                          # 主 React 应用源码
│   ├── index.tsx                 # 入口：初始化引擎，渲染 React 根组件
│   ├── App.tsx                   # 根组件（挂载 SpreadsheetRoot）
│   ├── core/                     # 核心扩展逻辑（引擎初始化、文件 I/O、i18n、权限、公式编辑）
│   │   ├── engine/               # 引擎单例（initEngine, getEngine）
│   │   ├── author/               # 用户管理
│   │   ├── events/               # 事件处理
│   │   ├── i18n/                 # 国际化
│   │   ├── permissions/          # 权限系统
│   │   └── transaction.ts        # 事务处理
│   ├── components/               # React UI 组件（22 个子目录）
│   │   ├── spreadsheet-view/     # 主电子表格视图
│   │   ├── engine-canvas/        # Canvas 渲染
│   │   ├── toolbar/              # 工具栏
│   │   ├── sheets-tab/           # 工作表标签
│   │   ├── block-composer/       # 块创建
│   │   ├── block-interface/      # 块交互 UI
│   │   ├── craft-panel/          # 插件面板
│   │   ├── find-dialog/          # 查找对话框
│   │   ├── format-dialog/        # 格式对话框
│   │   ├── diff-layer/           # 差异可视化
│   │   ├── scrollbar/            # 自定义滚动条
│   │   ├── suggest/              # 自动补全建议
│   │   ├── comment-layer/        # 单元格批注
│   │   └── root/                 # 根布局组件
│   ├── store/                    # MobX 全局 Store
│   │   └── store.ts              # 活跃视图、临时模式、分屏、网格线、批注等状态
│   ├── ui/                       # 共享 UI 组件
│   └── assets/                   # 静态资源（样式、图片）
│
├── packages/                     # Yarn workspace 包
│   ├── core/                     # logisheets-core：UI 无关的核心逻辑（ops, value, validation, format, craft 等）
│   ├── engine/                   # logisheets-engine：Svelte 5 的 Canvas 电子表格渲染组件
│   ├── web/                      # logisheets-web：浏览器 WASM SDK（薄封装）
│   ├── node/                     # logisheets：Node.js WASM 绑定（可发布的 npm 包）
│   ├── runtime/                  # logisheets-runtime：Node.js 无头电子表格运行时
│   ├── formula-editor/           # logisheets-formula-editor：CodeMirror 6 公式编辑器
│   ├── logician/                 # logician：AI agent 工作簿工具包（跨平台）
│   │   └── src/                  # agent/、tools/、craft interactions、对话管理
│   └── zk-web/                   # logisheets-zk-web：浏览器端 ZK/区块链集成层
│       └── src/                  # SMT、prover、合约 ABI、链上提交
│
├── zk/                           # ZK 相关 Rust workspace（新增）
│   ├── logisheets-zk-math/       # no_std 金融数学函数
│   ├── logisheets-zk-core/       # SMT、序列化类型、Merkle proof
│   ├── logisheets-zk-guest/      # RiscZero guest program（公式执行 + proof 生成）
│   ├── logisheets-zk-host/       # Host prover CLI
│   ├── logisheets-zk-methods/    # Guest ELF / image ID 构建
│   └── examples/                 # 示例季度报告输入 JSON
│
├── contracts/                    # Solidity 智能合约（新增）
│   ├── src/                      # FormulaRegistry.sol, QuarterlyReport.sol
│   ├── script/                   # Foundry 部署脚本
│   └── test/                     # Foundry 测试
│
├── crates/                       # Rust workspace（核心引擎）
│   ├── api/                      # logisheets-rs：公开的 Rust API
│   ├── controller/               # logisheets_controller：核心引擎（计算、公式、撤销/重做、块、样式等，31 个子模块）
│   │   ├── lexer/                # 公式词法分析器
│   │   ├── parser/               # 公式语法分析器
│   │   ├── lexer4fmt/            # 格式字符串词法分析器
│   │   ├── ast_checker/          # AST 校验
│   │   └── base/                 # 基础共享类型
│   ├── workbook/                 # logisheets_workbook：.xlsx 读写（OOXML 解析，ZIP I/O）
│   ├── wasms/server/             # WASM 编译目标（JS 调用入口：controller.rs, manager.rs, rpc.rs, ws.rs）
│   ├── sequencer/                # 计算图 / 依赖追踪
│   ├── buildtools/               # 代码生成工具（gen-bindings）
│   ├── logiscript/               # LogiScript 脚本语言
│   └── xmldiff/                  # XML 差异对比工具（用于测试）
│
├── crafts/                       # 插件应用（Crafts）— 自包含的迷你应用
│   ├── factory-simulator-core/   # 工厂模拟器核心
│   ├── factory-simulator-zh/     # 工厂模拟器（中文）
│   ├── factory-simulator-en/     # 工厂模拟器（英文）
│   ├── watson/                   # AI 助手（基于 logician）
│   ├── what-if-calculator/       # 情景分析
│   ├── markdown-table-extractor/ # Markdown 表格提取器
│   └── data-gateway/             # 数据网关
│
├── resources/                    # 静态资源
│   ├── funcs/                    # 函数元数据 JSON（103 个内置函数）
│   └── locale/                   # 多语言文件
│
├── docs/                         # VitePress 文档站
├── e2e/                          # Playwright 端到端测试
├── tests/                        # Rust 集成测试 + 测试用 .xlsx 文件
├── scripts/                      # 构建 & 工具脚本（函数 JSON 合并等）
├── public/                       # 静态 Web 资源
├── webpack.config.ts             # Webpack 配置（入口 src/index.tsx，端口 4200）
├── vite.config.ts                # Vitest 配置
├── tsconfig.json                 # TypeScript 配置
├── Cargo.toml                    # Rust workspace 根配置
├── playwright.config.ts          # Playwright 配置（端口 4288）
└── vercel.json                   # Vercel 部署配置
```

---

## 核心功能

### 1. 完整 .xlsx 兼容
读写真实的 Excel 文件，保留公式、样式、格式化等结构。由 `logisheets_workbook` Rust crate 提供支持（OOXML 解析器 + ZIP I/O）。

### 2. 高性能电子表格引擎（Rust + WASM）
公式解析、求值、依赖追踪、重算全部在 Rust 中完成。使用不可变持久化数据结构（`imbl`）实现高效撤销/重做。约 103 个内置函数（sum、vlookup、if、统计、财务、日期时间等）。

### 3. Blocks（结构化数据）
"Block" 是一个带 Schema 类型定义的表格区域，包含字段类型、校验规则、唯一性约束和稳定 ID。单元格通过稳定键寻址，因此插入/删除行永远不会破坏引用。

### 4. Crafts（插件系统）
自包含的 TypeScript/JavaScript 迷你应用，通过公开的 API 扩展 LogiSheets。

### 5. AI 原生（Logician + Watson）
- `logician`：跨平台的 AI agent 工具包，用于操作工作簿。
- `watson`：基于 logician 的应用内 AI 助手 Craft。

### 6. Canvas 渲染（logisheets-engine）
基于 Svelte 5 的高性能电子表格 UI 组件，使用 Canvas 自定义渲染。支持 Web Worker 离主线程计算。

### 7. CodeMirror 6 公式编辑器
语法高亮、自动补全和行内编辑的富公式编辑体验。

### 8. 跨平台
同一引擎可在浏览器（WASM）、Node.js（无头）、AI 工具包中运行。`logisheets-core` 是所有宿主共享的 UI 无关逻辑。

### 9. 协作准备
支持 WebSocket（`ws.rs`），基于事务的架构，支持差异可视化和临时模式。

### 10. 国际化
`react-i18next` + `resources/locale/` 多语言资源文件。

### 11. 丰富 UI
基于 MUI 的工具栏、右键菜单、查找对话框、格式对话框、Block 编辑器、拖拽排序、分屏视图。

---

## 数据流架构

```
┌──────────────────────────────────────────────────┐
│                    浏览器应用                      │
│  src/ (React + MobX) ← 使用 → logisheets-core    │
│       ↓                                          │
│  logisheets-engine (Svelte Canvas)                │
│       ↓                                          │
│  logisheets-web (TypeScript → WASM RPC)           │
│       ↓                                          │
│  crates/wasms/server (WASM binding)               │
│       ↓                                          │
│  crates/controller (Rust 引擎核心)                │
│  crates/workbook (.xlsx I/O)                      │
└──────────────────────────────────────────────────┘
```

同一 Rust 引擎也可通过 `logisheets`（Node 包）和 `logisheets-runtime` 在 Node.js 中无头运行。AI 工具包 `logician` 通过 `logisheets-core` + 结构化工具操作工作簿——全部共享同一逻辑，无需重复实现。

---

## 开发命令

### 环境准备

```bash
yarn install        # 安装依赖
yarn gen-bindings   # 生成 TypeScript 类型绑定（从 Rust）
yarn run-scripts    # 合并函数 JSON（resources/funcs/*.json → funcs.json）
```

### 构建 WASM 引擎

```bash
yarn wasm           # 构建 Rust → WASM
```

### 开发

```bash
yarn start          # 完整开发环境（构建 WASM + 引擎 + 启动 Webpack DevServer，端口 4200）
yarn start:dev      # 快速开发（跳过 WASM 重建，仅启动 Webpack DevServer）
```

### 生产构建

```bash
yarn build          # 构建 Crafts + Webpack 生产打包
```

### 测试

```bash
yarn test           # 单元测试（Vitest）
yarn test:e2e       # 端到端测试（Playwright，无头）
yarn test:e2e:headed # 端到端测试（Playwright，有头）
cargo test          # Rust 集成测试
```

### 代码规范

```bash
yarn lint           # ESLint 检查并自动修复
```

### 文档

```bash
yarn docs:dev       # 启动 VitePress 文档开发服务器
yarn docs:build     # 构建文档
```

### 子包构建

```bash
yarn workspace logisheets-formula-editor build
yarn workspace logisheets-engine build
yarn workspace logisheets-core build
yarn workspace logisheets-zk-web build
```

---

## Blockchain ZK 架构

### 数据流

```
┌──────────────────────────────────────────────────────────────────────┐
│                        浏览器应用                                     │
│  src/ (React + MobX)                                                  │
│       ↓                                                               │
│  packages/zk-web                                                      │
│       - Sparse Merkle Tree 构建                                       │
│       - 公式 commitment                                               │
│       - mockProve / 真实 prover 调用                                  │
│       - 链上交易提交                                                  │
│       ↓                                                               │
│  zk/logisheets-zk-host                                                │
│       - 读取输入 JSON                                                 │
│       - RiscZero Prover 生成 proof                                    │
│       ↓                                                               │
│  zk/logisheets-zk-guest (inside zkVM)                                 │
│       - 验证 SMT Merkle proof                                         │
│       - 执行金融公式（NPV/IRR/PMT/FV/PV 等）                           │
│       - 提交 public outputs                                           │
└──────────────────────────────────────────────────────────────────────┘
                           │ Proof + Public I/O
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        链上                                           │
│  FormulaRegistry.sol  ← 公式 CRUD + SMT root                          │
│  QuarterlyReport.sol  ← 验证 proof + 存储季度结果                      │
│  IRiscZeroVerifier    ← Groth16 proof 验证                            │
└──────────────────────────────────────────────────────────────────────┘
```

### 公式 CRUD

| 操作 | 链下 | 链上 |
|------|------|------|
| Create | Parser → AST → commitment → SMT insert → new root | `FormulaRegistry.registerFormula` |
| Update | 新 expression → 新 commitment → SMT update → new root | `FormulaRegistry.updateFormula` |
| Delete | SMT delete → new root | `FormulaRegistry.deleteFormula` |

### 季度报告流程

1. 用户在 LogiSheets 中定义/更新公式 → commit 到 `FormulaRegistry`
2. 每季度输入现金流、折现率、估值等数据
3. 浏览器 `logisheets-zk-web` 构建 SMT 并生成 Merkle proofs
4. 将输入发送给 `zk/logisheets-zk-host` 生成 RiscZero proof
5. 调用 `QuarterlyReport.submitReport` 上链验证并存储结果
6. 任何人可链上查询 `getOutput(fundId, quarterId, key)` 验证结果

### ZK 开发命令

```bash
# 构建 ZK 数学/核心库（暂需本地安装 MSVC 链接器）
cd zk && cargo build -p logisheets-zk-math -p logisheets-zk-core

# 本地 mock 执行季度报告（无需 proof）
cd zk && cargo run -p logisheets-zk-host -- mock examples/q1-report.json

# 真实 proof 生成（需要 RiscZero 工具链）
cd zk && cargo run -p logisheets-zk-host --features prove -- prove examples/q1-report.json

# Foundry 合约测试
cd contracts && forge test

# 构建浏览器 ZK 集成包
yarn workspace logisheets-zk-web build
```

### 当前限制与后续工作

- **MSVC 链接器**：当前环境缺少 `link.exe`，`zk/` 下的 Rust crate 无法本地编译验证。需在 Windows 安装 Visual Studio Build Tools 或 MinGW。
- **ZK-friendly hash**：当前 SMT 使用 SHA-256 便于浏览器实现；生产环境建议切换为 Poseidon 以减少 RiscZero guest cycles。
- **真实 proving**：`logisheets-zk-host` 的 `prove` 子命令需要完整 RiscZero 工具链；`mock` 子命令已可本地执行公式并验证 SMT。
- **公式解析器**：v1 guest 使用轻量 parser 支持核心金融函数；后续将复用 `crates/controller/parser` 的完整 Excel 公式解析器。

