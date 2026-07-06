# LogiSheets → Blockchain-Native ZK Spreadsheet 技术方案设计

## 1. 项目定位

将 LogiSheets 改造为 **区块链原生、基于零知识证明的金融电子表格平台**：

> 金融分析师通过 LogiSheets 定义可信的计算公式（如 NPV、IRR、投资回报率等），每个季度输入实际数据，系统生成 ZK Proof 证明「在已承诺的公式下，给定输入 → 输出」的正确性。Proof 提交上链后，任何人均可验证计算结果，无需信任分析师或任何中心化实体。

标记：**"From sheets to systems → From sheets to on-chain truth."**

---

## 2. 核心目标

| 目标 | 描述 |
|------|------|
| **公式承诺 (Formula Commitment)** | 每套公式生成唯一的 Merkle Root，上链锚定，确保公式不可篡改 |
| **公式 CRUD** | 支持公式的创建、修改、删除，每次变更产生新的 commitment 并有事件上链 |
| **季度输入模型** | 每季度输入一组公开值（如现金流、估值参数），自动计算投资回报率等指标 |
| **ZK 可验证计算** | 计算结果附带 ZK Proof，链上合约验证 proof 后存储结果 |
| **隐私可选** | 公式内容可作为私有输入（仅 commitment 上链），输入/输出值可选择性公开 |

---

## 3. 整体架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Off-Chain (用户本地)                           │
│                                                                        │
│  ┌──────────────────┐   ┌───────────────────────────┐                │
│  │  LogiSheets UI    │──▶│  Formula Editor (CRUD)     │               │
│  │  (React + Svelte) │   │  创建/编辑/删除公式         │               │
│  └────────┬──────────┘   └─────────────┬─────────────┘               │
│           │                            │                              │
│           ▼                            ▼                              │
│  ┌─────────────────────────────────────────────────────┐             │
│  │              Formula Manager (Off-Chain)              │            │
│  │  ┌───────────────┐  ┌──────────────┐  ┌───────────┐  │            │
│  │  │ 公式解析存储   │  │ 依赖图构建    │  │ Merkle化   │  │            │
│  │  │ (Parser+AST)  │  │ (Graph+Deps) │  │ (SMT)      │  │            │
│  │  └───────────────┘  └──────────────┘  └───────────┘  │            │
│  └───────────────────────┬─────────────────────────────┘             │
│                          │                                            │
│                          ▼                                            │
│  ┌─────────────────────────────────────────────────────┐             │
│  │              ZK Prover (RiscZero zkVM)               │            │
│  │  Guest Program:                                      │            │
│  │    Input(private): formulas, merkle proofs, inputs   │            │
│  │    Input(public):  formula_root, quarterly_inputs    │            │
│  │    Execute: 按依赖顺序执行公式 → 计算结果              │            │
│  │    Output(public): quarterly_results                 │            │
│  └───────────────────────┬─────────────────────────────┘             │
│                          │ Proof + Public I/O                         │
└──────────────────────────┼──────────────────────────────────────────┘
                           │  On-Chain Transaction
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         On-Chain (区块链)                             │
│                                                                        │
│  ┌─────────────────────────────────────────────────────┐             │
│  │          FormulaRegistry Contract                    │             │
│  │  - registerFormula(fundId, formulaId, commitment)    │             │
│  │  - updateFormula(fundId, formulaId, newCommitment)   │             │
│  │  - deleteFormula(fundId, formulaId)                  │             │
│  │  - formulaRoot(fundId) → bytes32                     │             │
│  │  - Events: FormulaCreated/Updated/Deleted            │             │
│  └───────────────────────┬─────────────────────────────┘             │
│                          │                                            │
│                          ▼                                            │
│  ┌─────────────────────────────────────────────────────┐             │
│  │        QuarterlyReport Contract                      │             │
│  │  - submitReport(fundId, quarterId, proof, pubIO)     │             │
│  │  - verifyProof(proof, pubIO) → bool                  │             │
│  │  - reports(fundId, quarterId) → ReportResult          │            │
│  └───────────────────────┬─────────────────────────────┘             │
│                          │                                            │
│                          ▼                                            │
│  ┌─────────────────────────────────────────────────────┐             │
│  │        ZK Verifier Contract                          │             │
│  │  - verifyRiscZeroReceipt(seal, imageId, journal)     │             │
│  │  - On-chain RiscZero Groth16 verifier                 │             │
│  └─────────────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. ZK 方案选型

### 候选方案对比

| 维度 | RiscZero zkVM | Circom (Groth16) | Plonky3 |
|------|--------------|------------------|---------|
| 开发难度 | **低** — 直接写 Rust guest | 高 — 需要手写电路 | 中高 — Rust DSL |
| 现有代码复用 | **高** — math/ 模块直接复用 | 低 — 全部重写为电路 | 中 — 需适配 |
| 证明生成时间 | 分钟级（optimized 可到几十秒） | **秒级**（per 公式） | 秒级 |
| Proof 大小 | ~200KB (Groth16 wrapping) | **~256 bytes** | ~2-3KB |
| 链上验证成本 | ~230K gas | **~200K gas** | ~300K+ gas |
| 金融函数支持 | **全支持**（f64 在 zkVM 内可用） | 需自己实现浮点 | 需实现浮点 |
| 生态成熟度 | 高（主网上线） | 最高 | 中 |

### 推荐方案：RiscZero zkVM + Groth16 wrapping

**选择理由：**

1. **最大代码复用**：LogiSheets 的公式引擎（Parser → AST → Calc）已有约 170 个函数的 Rust 实现，RiscZero guest program 中可以直接复用 `math/` 下的纯函数模块（NPV、IRR、PMT、FV、PV 等），几乎不需要重写
2. **f64 浮点支持**：金融计算必须使用浮点运算，RiscZero zkVM 支持完整的 f64 运算（via soft-float），而 Circom 需要自己实现浮点电路，极其复杂且易出错
3. **快速迭代**：金融公式需求变化频繁，Rust guest program 可以随时修改重新编译，无需重新设计电路和 setup ceremony
4. **Groth16 wrapping**：RiscZero 支持将 STARK proof 包装为 Groth16 proof，最终上链验证只需 ~230K gas，proof 大小 ~256 bytes
5. **适用场景**：季度报告不需要实时证明（几分钟完全可接受），正好匹配 zkVM 的证明时间

**暂不选 Circom/Plonky3 的原因**：手写电路维护 170+ 个金融函数 + f64 运算的实现成本极高，且每次公式变更需要重新编译电路并完成 trusted setup。

---

## 5. 公式承诺 (Formula Commitment) 方案

### 5.1 数据结构

每个公式定义为：

```rust
struct Formula {
    id: [u8; 32],        // keccak256(formula_text + version)
    name: String,         // 公式名称，如 "Quarterly ROI"
    expression: String,   // 公式文本，如 "=(B1-B0)/B0"
    version: u64,         // 版本号（每次修改递增）
    created_at: u64,      // Unix timestamp
    updated_at: u64,
}
```

### 5.2 Sparse Merkle Tree (SMT) 结构

使用 **Blake2 或 Poseidon 哈希**的 Sparse Merkle Tree 存储公式承诺：

```
                    Root (bytes32)
                   /              \
          Hash(L)                  Hash(R)
         /      \                /      \
    Hash(LL)  Hash(LR)    Hash(RL)  Hash(RR)
      │          │           │          │
   formula_0  formula_1  formula_2  formula_3  ...
```

- Leaf = `hash(formula_id, formula_expression_hash)`
- Empty leaf = `hash(0)`（默认值）
- **Create**: 插入新叶子，更新根哈希
- **Update**: 修改叶子值，更新根哈希（同一 formula_id，新 expression_hash）
- **Delete**: 叶子设为 `hash(0)`，更新根哈希
- 每次操作生成 **Merkle Proof**（siblings path），供 ZK 验证

### 5.3 On-Chain 存储

```solidity
contract FormulaRegistry {
    // fundId → merkle root
    mapping(uint256 => bytes32) public formulaRoots;

    // fundId → formulaId → commitment hash
    mapping(uint256 => mapping(bytes32 => bytes32)) public formulas;

    // fundId → formulaId → version
    mapping(uint256 => mapping(bytes32 => uint64)) public formulaVersions;

    event FormulaCreated(uint256 indexed fundId, bytes32 indexed formulaId, uint64 version);
    event FormulaUpdated(uint256 indexed fundId, bytes32 indexed formulaId, uint64 version);
    event FormulaDeleted(uint256 indexed fundId, bytes32 indexed formulaId);

    function registerFormula(uint256 fundId, bytes32 formulaId, bytes32 commitment) external;
    function updateFormula(uint256 fundId, bytes32 formulaId, bytes32 newCommitment) external;
    function deleteFormula(uint256 fundId, bytes32 formulaId, bytes32[] calldata proof) external;
}
```

### 5.4 实际 Workflow

```
用户操作: 创建公式 "ROI = (EndValue - StartValue) / StartValue"

Off-chain:
  1. Parser 解析公式 → AST
  2. formula_id = keccak256("ROI = (EndValue - StartValue) / StartValue" || version=1)
  3. formula_hash = hash(formula_id, hash(expression))
  4. 插入 SMT，计算新 root
  5. 生成 Merkle proof（当前 formula_id 的 inclusion proof）

On-chain:
  1. registerFormula(fundId, formulaId, commitment)
  2. 更新 formulaRoots[fundId] = newRoot
  3. 发出 FormulaCreated 事件
```

---

## 6. ZK Proof 生成与验证

### 6.1 Guest Program 设计

RiscZero guest program 的核心逻辑（复用了 LogiSheets 现有引擎）：

```rust
// guest/src/main.rs — RiscZero Guest Program
#![no_main]
risc0_zkvm::guest::entry!(main);

fn main() {
    // === 读取私有输入 ===
    let formulas: Vec<FormulaWithProof> = env::read();  // 公式 + Merkle proofs
    let private_inputs: HashMap<String, f64> = env::read(); // 私有输入值

    // === 读取公开输入 ===
    let formula_root: Digest = env::read();             // 链上公式 root
    let public_inputs: HashMap<String, f64> = env::read(); // 季度公开输入
    let expected_outputs: Vec<OutputDef> = env::read(); // 预期输出字段定义

    // === 1. 验证 Merkle proofs ===
    for f in &formulas {
        verify_merkle_proof(
            &formula_root,
            &f.id,
            &f.commitment_hash(),
            &f.proof
        );
    }

    // === 2. 解析所有公式 AST ===
    let parsed: Vec<(FormulaId, ast::Node)> = formulas.iter()
        .map(|f| (f.id, Parser::parse(&f.expression)))
        .collect();

    // === 3. 构建依赖图 & 拓扑排序 ===
    // 复用 crates/controller/src/formula_manager/graph.rs 的逻辑
    let sorted = topological_sort(&parsed, &public_inputs);

    // === 4. 按序执行计算 (复用 math/ 模块) ===
    // 复用 crates/controller/src/calc_engine/calculator/ 的逻辑
    let results = execute_formulas(sorted, &public_inputs, &private_inputs);

    // === 5. 提交公开输出 ===
    for output_def in &expected_outputs {
        let value = results.get(&output_def.name).unwrap();
        env::commit(&(output_def.name.clone(), *value));
    }

    // 额外提交：formula_root 确保 proof 绑定到正确的公式集合
    env::commit(&formula_root);
}
```

### 6.2 现有代码复用矩阵

| 模块 | 路径 | 复用方式 | 适配工作 |
|------|------|---------|---------|
| 公式解析器 | `crates/controller/parser/` | 直接复用 | 去除 std 依赖，适配 no_std |
| 数学函数库 | `crates/controller/src/calc_engine/calculator/math/` | **直接复用** | 几乎无需修改（纯计算） |
| 函数分发器 | `crates/controller/src/calc_engine/calculator/funcs/` | 复用 | 去除 Connector trait 依赖 |
| 依赖图构建 | `crates/controller/src/formula_manager/graph.rs` | 复用 | 泛型 Graph 可直接使用 |
| 拓扑排序 | `crates/controller/src/calc_engine/calc_order.rs` | 复用 | Tarjan SCC 可直接使用 |
| 金融函数 | `math/npv.rs`, `math/irr.rs`, `math/pmt.rs`, `math/fv.rs`, `math/pv.rs` 等 | **直接复用** | 零修改 |
| UNDO/REDO | `crates/controller/src/version_manager/` | **不在 ZK 中使用** | ZK proof 不关心历史 |
| Connector | `crates/controller/src/calc_engine/connector.rs` | **重新设计** | 改为静态数据源 |

### 6.3 关键改造点：无状态计算器

现有引擎中 `Connector` trait 桥接了计算器和工作簿状态，不适合 ZK 环境。需要创建一个**无状态的伪 Connector**：

```rust
// zk-guest 专用: 将所有输入值预加载到 HashMap 中
struct StaticConnector {
    values: HashMap<String, CalcValue>,  // "A1" → 42.0, "B1" → 100.0
    func_registry: HashMap<FuncId, String>,
}

impl Connector for StaticConnector {
    fn convert(&mut self, r: &ast::CellReference) -> CalcVertex {
        // 不再查询动态 sheet/cell，直接从 values map 查找
        let key = format_cell_key(r);
        self.values.get(&key)
            .map(|v| CalcVertex::Value(v.clone()))
            .unwrap_or(CalcVertex::Value(CalcValue::Scalar(Value::Error(Error::Ref))))
    }
    // ... 其他方法直接 panic 或返回默认值（ZK 环境中不需要的状态操作）
}
```

### 6.4 支持的白名单函数（ZK 环境中）

第一期（金融核心函数，~25 个）：

| 函数 | 用途 |
|------|------|
| NPV, IRR | 净现值、内部收益率 |
| FV, PV | 终值、现值 |
| PMT, IPMT, PPMT | 等额还款、利息部分、本金部分 |
| RATE, NPER | 利率、期数 |
| SLN, SYD | 直线折旧、年数总和折旧 |
| CUMIPMT | 累计利息 |
| EFFECT, NOMINAL | 有效年利率、名义年利率 |
| PRICE, YIELD | 债券定价、收益率 |
| SUM, AVERAGE, MIN, MAX | 基础聚合 |
| IF, AND, OR, NOT | 条件逻辑 |
| +, -, *, /, ^ | 基础算术 |
| LN, EXP, SQRT | 数学函数 |

完整列表从 `resources/funcs/` 中筛选。后续版本通过 guest program 升级逐步解锁更多函数。

### 6.5 证明生成流程

```bash
# 1. 用户在 LogiSheets UI 中定义公式并输入季度数据
# 2. 系统生成 proof input JSON
{
  "formulas": [
    {
      "id": "0xabcd...",
      "expression": "=NPV(D1, E1:E12)",
      "merkle_proof": ["0x...", "0x..."],
      "key": 0
    }
  ],
  "public_inputs": {
    "D1": 0.05,
    "E1": -1000, "E2": 200, "E3": 300, "E4": 400, "E5": 500,
    "E6": 500, "E7": 500, "E8": 500, "E9": 500, "E10": 500,
    "E11": 500, "E12": 500
  },
  "private_inputs": {},
  "expected_outputs": ["NPV_Result"],
  "formula_root": "0xsmt_root_hash..."
}

# 3. 本地生成 proof
cargo run --release --bin prover -- --input report_q1.json

# 4. 输出
{
  "proof": "0xgroth16_proof_bytes...",
  "public_outputs": {
    "NPV_Result": 2543.21,
    "formula_root": "0xsmt_root_hash..."
  },
  "image_id": "0xguest_program_image_id..."
}

# 5. 提交上链
cast send $QUARTERLY_REPORT_CONTRACT \
  "submitReport(uint256,uint256,bytes,bytes32,bytes32[])" \
  $FUND_ID $Q1 \
  0xgroth16_proof_bytes... \
  0xguest_program_image_id... \
  "[0xsmt_root_hash..., 0x2543.21...]"
```

---

## 7. 季度报告智能合约

### 7.1 QuarterlyReport.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRiscZeroVerifier {
    function verify(
        bytes calldata seal,
        bytes32 imageId,
        bytes32 postStateDigest,
        bytes32 journalDigest
    ) external view returns (bool);
}

contract QuarterlyReport {
    struct ReportResult {
        uint256 fundId;
        uint256 quarterId;      // Q index: 1, 2, 3, 4
        bytes32 formulaRoot;     // 绑定到此报告使用的公式集合
        uint64 timestamp;
        mapping(string => int256) outputs; // 输出值（用 scaled int 表示定点数）
        bool verified;
    }

    // fundId → quarterId → ReportResult
    mapping(uint256 => mapping(uint256 => ReportResult)) public reports;
    mapping(uint256 => mapping(uint256 => bool)) public reportExists;

    IRiscZeroVerifier public verifier;
    bytes32 public imageId; // Guest program 的固定 Image ID

    // fundId → current formula root
    mapping(uint256 => bytes32) public currentFormulaRoot;

    event ReportSubmitted(
        uint256 indexed fundId,
        uint256 indexed quarterId,
        bytes32 formulaRoot,
        bytes32[] outputKeys,
        int256[] outputValues
    );

    constructor(address _verifier, bytes32 _imageId) {
        verifier = IRiscZeroVerifier(_verifier);
        imageId = _imageId;
    }

    function submitReport(
        uint256 fundId,
        uint256 quarterId,
        bytes calldata seal,
        bytes32 postStateDigest,
        bytes calldata journal         // public outputs encoded in journal
    ) external {
        require(!reportExists[fundId][quarterId], "Report already submitted");

        // 解码 journal: formula_root + output KV pairs
        (bytes32 reportedRoot, string[] memory keys, int256[] memory values) =
            abi.decode(journal, (bytes32, string[], int256[]));

        require(keys.length == values.length, "Mismatched output arrays");
        require(reportedRoot == currentFormulaRoot[fundId], "Formula root mismatch");

        // 验证 ZK Proof
        bytes32 journalDigest = sha256(journal);
        require(
            verifier.verify(seal, imageId, postStateDigest, journalDigest),
            "ZK proof verification failed"
        );

        // 存储结果
        ReportResult storage report = reports[fundId][quarterId];
        report.fundId = fundId;
        report.quarterId = quarterId;
        report.formulaRoot = reportedRoot;
        report.timestamp = uint64(block.timestamp);
        report.verified = true;

        for (uint i = 0; i < keys.length; i++) {
            report.outputs[keys[i]] = values[i];
        }

        reportExists[fundId][quarterId] = true;

        emit ReportSubmitted(fundId, quarterId, reportedRoot, keys, values);
    }
}
```

### 7.2 FormulaRegistry.sol

```solidity
contract FormulaRegistry {
    mapping(uint256 => bytes32) public formulaRoots;
    mapping(uint256 => mapping(bytes32 => FormulaData)) public formulas;
    mapping(uint256 => bytes32[]) public formulaIdList; // for iteration

    struct FormulaData {
        bytes32 commitment;
        uint64 version;
        uint64 updatedAt;
        bool exists;
    }

    event FormulaRegistered(uint256 indexed fundId, bytes32 indexed formulaId, uint64 version);
    event FormulaUpdated(uint256 indexed fundId, bytes32 indexed formulaId, uint64 newVersion);
    event FormulaDeleted(uint256 indexed fundId, bytes32 indexed formulaId);

    function registerFormula(
        uint256 fundId,
        bytes32 formulaId,
        bytes32 commitment,
        bytes32 newRoot
    ) external {
        require(!formulas[fundId][formulaId].exists, "Formula exists");
        formulas[fundId][formulaId] = FormulaData(commitment, 1, uint64(block.timestamp), true);
        formulaIdList[fundId].push(formulaId);
        formulaRoots[fundId] = newRoot;
        emit FormulaRegistered(fundId, formulaId, 1);
    }

    function updateFormula(
        uint256 fundId,
        bytes32 formulaId,
        bytes32 newCommitment,
        bytes32 newRoot
    ) external {
        FormulaData storage f = formulas[fundId][formulaId];
        require(f.exists, "Formula not found");
        f.commitment = newCommitment;
        f.version++;
        f.updatedAt = uint64(block.timestamp);
        formulaRoots[fundId] = newRoot;
        emit FormulaUpdated(fundId, formulaId, f.version);
    }

    function deleteFormula(
        uint256 fundId,
        bytes32 formulaId,
        bytes32 newRoot
    ) external {
        require(formulas[fundId][formulaId].exists, "Formula not found");
        delete formulas[fundId][formulaId];
        formulaRoots[fundId] = newRoot;
        emit FormulaDeleted(fundId, formulaId);
    }
}
```

---

## 8. 项目目录结构（新增部分）

```
LogiSheets/
├── zk/                              # ZK 相关代码（新增）
│   ├── Cargo.toml                   # ZK workspace
│   ├── guest/                       # RiscZero Guest Program
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs              # Guest entry point
│   │       ├── merkle.rs            # SMT Merkle proof 验证
│   │       ├── engine.rs            # 无状态公式执行引擎
│   │       └── connector.rs         # StaticConnector 实现
│   ├── host/                        # Prover 宿主程序
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs              # Prover CLI
│   │       ├── input_builder.rs     # 构建 proof input JSON
│   │       └── smt.rs               # SMT 构建与更新
│   └── methods/                     # Guest program ID & ELF
│       └── src/
│           └── lib.rs
├── contracts/                       # Solidity 智能合约（新增）
│   ├── src/
│   │   ├── FormulaRegistry.sol
│   │   ├── QuarterlyReport.sol
│   │   └── interfaces/
│   │       └── IRiscZeroVerifier.sol
│   ├── script/
│   │   └── Deploy.s.sol            # Foundry 部署脚本
│   ├── test/
│   │   ├── FormulaRegistry.t.sol
│   │   └── QuarterlyReport.t.sol
│   └── foundry.toml
├── crates/                          # 现有 Rust 引擎（需适配）
│   ├── controller/
│   │   └── src/calc_engine/calculator/math/  # 直接复用，迁移到 zk/guest 依赖
│   ├── parser/                      # 公式解析器（需适配 no_std）
│   └── ...
└── packages/                        # 现有前端包
    └── web/
        └── src/
            └── zk/                  # 前端 ZK 集成层（新增）
                ├── prover.ts        # 调用本地 prover
                ├── smt.ts           # 客户端 SMT 操作
                └── submitter.ts     # 上链交易提交
```

---

## 9. 公式 CRUD 完整流程

### 9.1 创建公式 (Create)

```
用户: 新建公式 "Quarterly_ROI = (C4 - C1) / C1"

Off-Chain:
  1. Parser::parse("(C4 - C1) / C1") → AST
  2. formula_id = keccak256(expression || version=1)
  3. commitment = hash(formula_id, hash(expression))
  4. SMT.insert(formula_id, commitment)
  5. new_root = SMT.root()
  6. merkle_proof = SMT.prove(formula_id)

On-Chain:
  1. FormulaRegistry.registerFormula(fundId, formulaId, commitment, newRoot)
  2. formulaRoots[fundId] = newRoot
  3. emit FormulaRegistered

后续 Quarterly Report:
  - Guest program 中验证 merkle_proof
  - 执行公式
  - 输出 ROIRresult → 写入 journal
```

### 9.2 更新公式 (Update)

```
用户: 修改 "Quarterly_ROI" 为 "(C4 - C1 - C2) / C1"

Off-Chain:
  1. formula_id 保持不变
  2. 新 version = 旧 version + 1
  3. 新 commitment = hash(formula_id, hash(新 expression))
  4. SMT.update(formula_id, 新 commitment)
  5. new_root = SMT.root()

On-Chain:
  1. FormulaRegistry.updateFormula(fundId, formulaId, newCommitment, newRoot)
  2. formulaRoots[fundId] = newRoot
  3. emit FormulaUpdated (version incremented)

安全性:
  - 旧季度的 proof 仍可验证（引用旧的 formula_root）
  - 新季度使用新的 formula_root
  - 链上保留所有历史 root 的记录
```

### 9.3 删除公式 (Delete)

```
用户: 删除 "Quarterly_ROI"

Off-Chain:
  1. SMT.delete(formula_id) → 叶子设为 hash(0)
  2. new_root = SMT.root()

On-Chain:
  1. FormulaRegistry.deleteFormula(fundId, formulaId, newRoot)
  2. emit FormulaDeleted
```

---

## 10. 季度报告 Workflow

```
Q1 结束，用户有如下公式集合:
  - formula_1: "NPV_Result = NPV(D1, E1:E12)"
  - formula_2: "ROI = (EndValue - StartValue) / StartValue"
  - formula_3: "PMT_Monthly = PMT(rate/12, nper*12, principal)"

用户提供季度输入值:
  - StartValue = 1000000
  - EndValue = 1150000
  - D1 = 0.05 (discount rate)
  - E1..E12 = [-500000, 80000, 80000, ...]
  - rate = 0.04, nper = 10, principal = 500000

↓

Prover 运行:
  1. 从链上获取 formula_root
  2. 本地根据 formula_root 重建 SMT
  3. 为每个公式生成 inclusion proof
  4. 构建 guest program input（formulas + proofs + inputs）
  5. 运行 RiscZero prover → 生成 STARK proof
  6. STARK proof → Groth16 wrapping（压缩到 ~256 bytes）
  7. 提取 journal（public outputs）

↓

On-Chain:
  1. submitReport(fundId, 1, seal, postStateDigest, journal)
  2. 合约解码 journal → 验证 formula_root 匹配
  3. 调用 RiscZero verifier 验证 proof
  4. 存储 ReportResult
  5. emit ReportSubmitted

↓

任何人都可以查询:
  - reports[fundId][1].outputs["NPV_Result"] → 2543.21
  - reports[fundId][1].verified → true
  - 可独立重新验证 proof（链上或链下）
```

---

## 11. 对现有 LogiSheets 代码的改造影响

| 模块 | 影响 | 说明 |
|------|------|------|
| `crates/controller/parser/` | **低** | 适配 no_std（去除 HashMap → BTreeMap 等），核心逻辑不变 |
| `crates/controller/src/calc_engine/calculator/math/` | **零** | 纯函数，直接作为 zk/guest 的依赖 |
| `crates/controller/src/calc_engine/calculator/funcs/` | **低** | 条件编译：添加 `#[cfg(feature = "zk")]` 路径，使用 StaticConnector |
| `crates/controller/src/formula_manager/graph.rs` | **低** | 泛型 Graph 可直接复用 |
| `crates/controller/src/calc_engine/calc_order.rs` | **低** | Tarjan SCC 算法可直接复用 |
| `crates/controller/src/version_manager/` | **无** | ZK 场景不使用 undo/redo |
| `crates/workbook/` | **无** | ZK 场景不需要读写 .xlsx |
| `packages/web/` | **中** | 新增 ZK 集成层：公式 SMT 管理、Proof 生成调用、链上交易提交 |
| `packages/engine/` | **低** | Svelte 渲染不变，增加 ZK/Blockchain 面板 UI |
| `src/components/` | **中** | 新增：季度报告面板、Merkle 树可视化、链上交易状态 |

---

## 12. 路线图

### Phase 1: Foundation（约 6-8 周）
- [ ] 创建 `zk/` workspace，搭建 RiscZero 项目骨架
- [ ] 将 `math/` 模块抽取为独立 crate（`logisheets-math`），支持 `no_std`
- [ ] 实现无状态 `StaticConnector`
- [ ] Guest program v1：支持 10 个核心金融函数（NPV, IRR, FV, PV, PMT, SUM, IF, +, -, *）
- [ ] Host program：CLI 工具，输入 JSON，输出 proof
- [ ] SMT 实现（Poseidon hash）

### Phase 2: On-Chain（约 4-6 周）
- [ ] Solidity 合约开发（FormulaRegistry + QuarterlyReport）
- [ ] Foundry 测试 + 部署脚本
- [ ] RiscZero Verifier 合约集成
- [ ] 端到端测试：公式创建 → Proof 生成 → 链上验证

### Phase 3: UI Integration（约 4-6 周）
- [ ] LogiSheets 前端：ZK/Blockchain 面板
- [ ] 公式编辑器集成：一键 commit 公式到链
- [ ] 季度报告生成器：填输入值 → 生成 proof → 提交上链
- [ ] Merkle 树可视化
- [ ] 交易状态跟踪与链上报告查看

### Phase 4: Production（约 4-6 周）
- [ ] 更多金融函数支持（扩展到 50+ 函数）
- [ ] 证明性能优化（continuations, recursion）
- [ ] 隐私模式（输入值可选加密，仅公开公式 root + 输出值）
- [ ] 多基金/多投资组合管理
- [ ] 审计日志与链上报告浏览器
- [ ] 安全审计

---

## 13. 关键技术风险与缓解

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| f64 浮点精度跨平台不一致 | 链上链下 hash 不匹配 | 所有计算强制使用相同的 f64 实现（RiscZero soft-float 与 native f64 一致） |
| 证明生成时间过长（>30 分钟） | 用户体验差 | Continuations 分段证明 + 预计算；季度场景容忍度高 |
| 公式数量增长导致 SMT 变更成本高 | 高 gas 费 | 使用 L2（Optimism/Arbitrum）降低 gas；批量更新 SMT |
| Guest program 代码量过大导致 image ID 不稳定 | 升级困难 | 版本化 image ID；公式集白名单通过 journal 参数化 |
| 链上存储 output 值精度问题 | 精度丢失 | 使用 scaled int（如 18 位小数）存储，类似 ERC20 的 1e18 精度 |
| Merkle proof 验证在 zkVM 内耗费 cycles | 证明时间增加 | 使用 Poseidon hash（zk-friendly），而非 SHA-256/Keccak |

---

## 14. 附录：示例 — 季度投资回报计算

### 场景
某私募基金季度报告，需要计算投资组合的 NPV、IRR 和 ROI。

### 公式定义
```
// formula_1: 净值计算
Net_Value = SUM(C2:C13)

// formula_2: 净现值
NPV_Result = NPV(B1, C2:C13)

// formula_3: 内部收益率
IRR_Result = IRR(C1:C13)

// formula_4: 投资回报率
Quarterly_ROI = (C13 - C1) / ABS(C1)
```

### 输入值 (Q1 2026)
```
B1 = 0.10            (折现率 10%)
C1 = -1000000        (初始投资)
C2 = 50000
C3 = 60000
C4 = 55000
C5 = 70000
C6 = 75000
C7 = 80000
C8 = 85000
C9 = 90000
C10 = 95000
C11 = 100000
C12 = 105000
C13 = 110000         (Q1 末估值)
```

### 预期输出
```
Net_Value = 975000
NPV_Result = -482045.72
IRR_Result = -0.0245  (负 IRR，投资未回收)
Quarterly_ROI = 1.11  (111% 回报率)
```

### ZK Proof 验证
任何第三方可以用以下公开信息独立验证：
- `formula_root`: 0xabcd...（链上存储的公式承诺）
- `public_inputs`: B1=0.10, C1..C13
- `public_outputs`: Net_Value=975000, NPV_Result=-482045.72, IRR_Result=-0.0245, Quarterly_ROI=1.11
- 运行链上 verifier 确认 proof 有效
