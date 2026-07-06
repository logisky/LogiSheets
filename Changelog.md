# Blockchain ZK Spreadsheet — Changelog

> Branch: `test/blockchain-zk-spreadsheet`  
> Commit: `71dd1f3` — `zk: add ZK spreadsheet skeleton (RiscZero, SMT, contracts, web)`

## 已完成 (Done)

### 1. ZK Rust Workspace (`zk/`)

- **`logisheets-zk-math`**：将原 `crates/controller/src/calc_engine/calculator/math/` 中的核心金融函数抽取为 `no_std` crate，支持 NPV、IRR、PMT、FV、PV、SLN 等。
- **`logisheets-zk-core`**：
  - 公式类型与序列化结构 (`Formula`, `FormulaWithProof`, `PublicInputs`, `PrivateInputs`, `ProverInput`, `QuarterlyReport`)
  - Sparse Merkle Tree 验证逻辑（`smt.rs`）：256 层 SMT、Merkle proof 验证
  - 链下 SMT 构建器（`smt_builder.rs`）：insert / remove / root / proof
- **`logisheets-zk-guest`**：RiscZero guest program 骨架：
  - 读取 public/private inputs
  - 验证公式 inclusion proof
  - 执行轻量公式 AST（支持 SUM、NPV、IRR、FV、PV、PMT、SLN、ABS 与基础四则运算）
  - 提交 public outputs 到 journal
- **`logisheets-zk-host`**：Host prover CLI：
  - `mock` 子命令：本地构建 SMT、验证 root、执行公式并输出结果（无需 ZK proof）
  - `prove` 子命令占位（需 `--features prove` + RiscZero 工具链）
- **`logisheets-zk-methods`**：标准 RiscZero guest ELF / image ID 构建占位

### 2. Solidity 智能合约 (`contracts/`)

- **`FormulaRegistry.sol`**：公式 CRUD（register / update / delete），维护 fund-level SMT root，发出事件
- **`QuarterlyReport.sol`**：
  - `submitReport`：验证 RiscZero Groth16 receipt，检查 formula root 匹配，存储季度结果
  - `getOutput`：查询已验证输出
- **`script/Deploy.s.sol`**：Foundry 部署脚本
- **`test/FormulaRegistry.t.sol`**：公式注册/更新/删除单元测试

### 3. 前端 ZK 集成层 (`packages/zk-web/`)

- `types.ts`：ZK 类型定义
- `bytes.ts`：浏览器/Node 通用字节工具（无 `Buffer` 依赖）
- `smt.ts`：浏览器端 Sparse Merkle Tree 构建与 proof 验证
- `prover.ts`：
  - `buildProverInputAsync`：生成完整 prover input
  - `mockProve`：本地执行
  - `evaluateFormula`：轻量公式解析器
- `contracts.ts`：合约 ABI（FormulaRegistry / QuarterlyReport）
- `submitter.ts`：链上提交抽象（`WriteClient` / `ReadClient`），兼容 viem/ethers
- `README.md` + `package.json` + `tsconfig.json`

### 4. UI 组件 (`src/components/zk-report-panel/`)

- React + MUI 季度报告面板
- 展示公式、输入季度数据、运行 mock report、显示 formula root 与 outputs

### 5. 文档与配置

- `Dev.md` 更新：新增 Blockchain ZK 架构、数据流、命令说明
- `design/blockchain-zk-design.md`：完整技术方案设计文档
- `package.json`：新增 `logisheets-zk-web` workspace 依赖
- `tsconfig.json`：新增 `logisheets-zk-web` path alias
- `.gitignore`：新增 `zk/target` 忽略

---

## 未完成 / 待办 (TODO)

### 高优先级

- [ ] **环境搭建**：安装 Visual Studio Build Tools（MSVC 链接器）或 MinGW，以编译 `zk/` 下 Rust crate
- [ ] **环境搭建**：升级 Node 到 18+ 并安装 Yarn 4.5+，以构建 TypeScript 包
- [ ] **Rust 编译验证**：`cargo build -p logisheets-zk-math -p logisheets-zk-core`
- [ ] **RiscZero 工具链**：安装 `cargo-risczero` 并验证 guest 编译目标 `riscv32im-risc0-zkvm-elf`
- [ ] **完整公式解析器**：将 `crates/controller/parser` 适配为 `no_std`，替换 guest 中的轻量 parser
- [ ] **StaticConnector 实现**：将现有 `Connector` trait 改造为无状态版本，真正复用 `logisheets_controller` 的函数分发器
- [ ] **真实 proving 流程**：实现 `logisheets-zk-host` 的 `prove` 子命令，生成 RiscZero receipt 并做 Groth16 wrapping

### 中优先级

- [ ] **ZK-friendly hash**：将 SMT 从 SHA-256 切换到 Poseidon，减少 RiscZero guest cycles
- [ ] **合约测试补全**：为 `QuarterlyReport.sol` 编写 Foundry 测试（含 mock verifier）
- [ ] **合约部署**：配置 `RISCZERO_VERIFIER` 和 `RISCZERO_IMAGE_ID` 环境变量，实际部署到测试网
- [ ] **权限控制**：为 `FormulaRegistry` 添加 fund owner / multi-sig / DAO 治理
- [ ] **公式版本历史**：链上保留历史 formula root，支持旧季度报告的独立验证
- [ ] **隐私输入模式**：支持加密私有输入，仅公开 formula root 和 outputs

### 低优先级 / 后续优化

- [ ] **前端集成到 App.tsx**：将 `ZkReportPanel` 实际挂到主应用布局中
- [ ] **公式编辑器增强**：一键 commit 公式到链、显示链上 formula root、Merkle proof 可视化
- [ ] **季度报告向导**：引导用户输入季度数据、调用后端 prover、提交链上交易
- [ ] **链上报告浏览器**：按 fund / quarter 查询已验证的历史报告
- [ ] **更多金融函数**：扩展 guest 支持完整 103+ 个 Excel 函数
- [ ] **性能优化**：RiscZero continuations / proof aggregation 以支持复杂投资组合
- [ ] **跨链支持**：除 EVM 外，评估 Solana / Celestia / Aptos 等链的 verifier 适配

---

## 已知问题 / 阻塞

| 问题 | 影响 | 解决方案 |
|------|------|---------|
| 环境缺少 MSVC 链接器 `link.exe` | 无法编译 `zk/` 下任何 Rust crate | 安装 Visual Studio Build Tools 或 MinGW |
| Node 版本为 12.13.1，无 Yarn | 无法运行 `yarn workspace logisheets-zk-web build` | 安装 Node 18+ 与 Yarn 4.5+ |
| RiscZero 工具链未安装 | 无法编译 guest program / 生成真实 proof | 安装 `cargo-risczero` 并添加 target |
| `zk/examples/q1-report.json` 中的 `formulaRoot` 和 `proof.siblings` 是占位符 | 直接传给 host 会 root 校验失败 | 使用 `buildProverInputAsync` 生成有效输入 |
| `encodeJournal` 使用简化 ABI 编码 | 上链前必须用 viem/ethers 的 `encodeAbiParameters` 替换 | 在 `submitter.ts` 中接入真实 ABI encoder |

---

## 快速验证命令（待环境就绪后执行）

```bash
# Rust 构建
cd zk
cargo build -p logisheets-zk-math -p logisheets-zk-core
cargo run -p logisheets-zk-host -- mock examples/q1-report.json

# Foundry 合约测试
cd contracts
forge test

# TypeScript 构建
yarn workspace logisheets-zk-web build
```

---

## 设计目标回顾

将 LogiSheets 升级为**区块链原生、基于零知识证明的金融电子表格平台**：

1. 公式作为 commitment 上链，支持增删改
2. 每季度输入数据后生成 ZK Proof
3. 链上验证 investment returns（ROI、NPV、IRR 等）
4. 任何第三方无需信任即可验证计算结果

Slogan: **"From sheets to systems → From sheets to on-chain truth."**
