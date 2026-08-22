use super::FormulaExecutor;
use logisheets_base::errors::BasicError;
use logisheets_base::{
    BlockCellId, BlockId, BlockRange, CellId, EphemeralId, NormalRange, Range, RangeId, RefAbs,
    SheetId,
};
use logisheets_parser::Parser;
use logisheets_parser::ast::{self, RangeDisplay};
use std::collections::HashSet;

use crate::formula_manager::{FormulaManager, Vertex, ctx::FormulaExecCtx};

pub fn input_formula<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    row: usize,
    col: usize,
    formula: String,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    let cell_id = ctx.fetch_cell_id(&sheet, row, col)?;
    input(executor, sheet, cell_id, formula, None, ctx)
}

/// Register `formula` as the formula for a block cell addressed by
/// (block_id, block_row, block_col). Mirrors {@link input_formula} but
/// avoids translating through sheet-absolute coords — callers like the
/// BlockInput handler already have the block triple.
pub fn input_block_formula<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    block_id: BlockId,
    block_row: usize,
    block_col: usize,
    formula: String,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    let bcid = ctx.fetch_block_cell_id(&sheet, &block_id, block_row, block_col)?;
    input(executor, sheet, CellId::BlockCell(bcid), formula, None, ctx)
}

pub fn input_ephemeral_formula<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    id: EphemeralId,
    formula: String,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    if let Some((sheet_id, cell_id)) = ctx.get_cell_id_by_shadow_id(&id) {
        let range = match cell_id {
            CellId::NormalCell(normal_cell_id) => {
                Range::Normal(NormalRange::Single(normal_cell_id))
            }
            CellId::BlockCell(block_cell_id) => Range::Block(BlockRange::Single(block_cell_id)),
            CellId::EphemeralCell(_) => unreachable!(),
        };
        let range_id = ctx.fetch_range_id(&sheet_id, &range);
        let placeholder_node = ast::Node {
            pure: ast::PureNode::Reference(ast::CellReference::Mut(RangeDisplay {
                range_id,
                ref_abs: RefAbs::default(),
                sheet_id,
            })),
            bracket: true,
        };

        // If the shadow target is a block cell, build per-row `#FIELD`
        // and `#KEY` substitutes too — so validation formulas can reach
        // sibling fields (e.g. resolve the row's key column to feed a
        // BLOCKREF lookup against another block). Non-block targets get
        // only `#PLACEHOLDER`, matching the prior behavior.
        if let CellId::BlockCell(block_cell_id) = cell_id {
            if let Some(row_ctx) = ctx.block_cell_row_substitutes(sheet_id, &block_cell_id) {
                let siblings: std::collections::HashMap<String, BlockCellId> =
                    row_ctx.siblings.into_iter().collect();
                let key_node = ast::Node {
                    pure: ast::PureNode::Value(ast::Value::Text(row_ctx.key_value)),
                    bracket: false,
                };
                return input_with_resolver(
                    executor,
                    sheet,
                    CellId::EphemeralCell(id),
                    formula,
                    placeholder_node,
                    block_cell_id,
                    siblings,
                    key_node,
                    ctx,
                );
            }
        }

        input(
            executor,
            sheet,
            CellId::EphemeralCell(id),
            formula,
            Some(placeholder_node),
            ctx,
        )
    } else {
        let cell_id = CellId::EphemeralCell(id);
        input(executor, sheet, cell_id, formula, None, ctx)
    }
}

/// Resolve every `#FIELD` placeholder a template mentions into a concrete
/// reference node, so the resolver closure passed to
/// `parse_with_substitutes` only has to do a lookup.
///
/// Two-phase on purpose. A key-addressed `#FIELD("f", "k")` has to mint a
/// range id for its target, which needs `&mut ctx` — impossible inside the
/// closure, which runs while the parser is still holding the context. So
/// the placeholders are discovered up front by a lex-only scan.
///
/// `siblings` covers the no-key form (this row). A key names another row of
/// the SAME block; `ctx.block_cell_at_key` resolves it. An unresolvable
/// field or key is left out of the map, so the placeholder survives into
/// the AST and evaluates to `#NAME?` — visible, rather than quietly
/// treated as blank.
///
/// Range ids that this substitution introduces are recorded in
/// `substituted`, so the own-block coordinate check can tell them from a
/// coordinate the author typed. When `self_cell` is `Some`, a placeholder
/// resolving to that very cell is an error rather than a substitution: for
/// a value formula that is a self-loop, and the cycle iterator would
/// otherwise grind it out to a meaningless number. (Shadow formulas pass
/// `None` — a validation rule referring to the cell it validates is normal,
/// and lives on a separate ephemeral cell anyway.)
fn resolve_field_placeholders<C: FormulaExecCtx>(
    body: &str,
    sheet: SheetId,
    owner: &BlockCellId,
    siblings: &std::collections::HashMap<String, BlockCellId>,
    self_cell: Option<&BlockCellId>,
    substituted: &mut HashSet<RangeId>,
    ctx: &mut C,
) -> Result<std::collections::HashMap<logisheets_parser::Placeholder, ast::Node>, BasicError> {
    use logisheets_parser::Placeholder;
    let parser = Parser {};
    let Some(needed) = parser.scan_placeholders(body) else {
        return Ok(std::collections::HashMap::new());
    };
    let mut out = std::collections::HashMap::new();
    for ph in needed {
        let Placeholder::FieldRef(name, key) = &ph else {
            continue;
        };
        let target = match key {
            None => siblings.get(name).copied(),
            Some(k) => ctx.block_cell_at_key(sheet, owner, k, name),
        };
        let Some(target) = target else { continue };
        if self_cell == Some(&target) {
            return Err(BasicError::InvalidFormula(format!(
                "field rule {:?} resolves to the cell it is defining \
                 (field {:?}{}). A rule cannot compute from itself.",
                body,
                name,
                match key {
                    Some(k) => format!(", key {:?}", k),
                    None => String::new(),
                }
            )));
        }
        let range = Range::Block(BlockRange::Single(target));
        let range_id = ctx.fetch_range_id(&sheet, &range);
        substituted.insert(range_id);
        out.insert(
            ph,
            ast::Node {
                pure: ast::PureNode::Reference(ast::CellReference::Mut(RangeDisplay {
                    range_id,
                    ref_abs: RefAbs::default(),
                    sheet_id: sheet,
                })),
                bracket: true,
            },
        );
    }
    Ok(out)
}

/// Ephemeral input variant that resolves all three placeholder kinds:
/// `#PLACEHOLDER` → the shadow target cell, `#FIELD("X")` /
/// `#FIELD("X", "key")` → a cell in the target's block, `#KEY` → the
/// target's row key. Used for validation formulas on block cells.
fn input_with_resolver<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet: SheetId,
    cell_id: CellId,
    formula: String,
    placeholder: ast::Node,
    owner: BlockCellId,
    siblings: std::collections::HashMap<String, BlockCellId>,
    key_node: ast::Node,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    // A shadow formula lives on its own ephemeral cell, so it may point at
    // the cell it validates without any risk of a self-loop — `self_cell`
    // is None. `substituted` is unused here for the same reason: the
    // own-block coordinate check only guards value templates.
    let mut substituted = HashSet::new();
    let subs = resolve_field_placeholders(
        &formula,
        sheet,
        &owner,
        &siblings,
        None,
        &mut substituted,
        ctx,
    )?;
    let parser = Parser {};
    let ast = parser.parse_with_substitutes(&formula, sheet, ctx, &|kind| match kind {
        logisheets_parser::PlaceholderKind::Placeholder => Some(placeholder.clone()),
        logisheets_parser::PlaceholderKind::FieldRef(..) => subs.get(&kind.to_owned()).cloned(),
        logisheets_parser::PlaceholderKind::Key => Some(key_node.clone()),
    });
    let Some(ast) = ast else { return Ok(executor) };
    register_parsed_ast(executor, sheet, cell_id, ast, ctx)
}

/// Move the formulas of a region that has just become a block from their old
/// normal-cell identities to their new block-cell ones.
///
/// `ConvertBlock` re-homes the cells' CONTENT in the container, but a formula is
/// keyed by `CellId` in the formula manager and by a range id in the dependency
/// graph — so without this the formulas stayed registered against
/// `NormalCell`s that nothing points at any more. The cells kept their last
/// computed value and stopped recomputing: adopting a live model quietly froze
/// it into numbers. The tool's own promise is to adopt a table "without
/// touching its values", and the values were indeed intact; it was the model
/// that was gone.
///
/// Runs after the navigator has committed the new block, so the block cell ids
/// are resolvable.
pub fn convert_cells_to_block<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    block_id: BlockId,
    master_row: usize,
    master_col: usize,
    row_cnt: usize,
    col_cnt: usize,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    let mut executor = executor;
    for r in master_row..master_row + row_cnt {
        for c in master_col..master_col + col_cnt {
            let Ok(normal) = ctx.fetch_norm_cell_id(&sheet, r, c) else {
                continue;
            };
            let old_id = CellId::NormalCell(normal);
            let Some(ast) = executor.manager.formulas.remove(&(sheet, old_id)) else {
                continue; // a plain value; the container already moved it
            };
            // Detach the old vertex before the new one is wired up, or the
            // stale edges keep the converted cell's precedents pointing at a
            // cell id that no longer holds anything.
            let old_range = Range::Normal(NormalRange::Single(normal));
            let old_range_id = ctx.fetch_range_id(&sheet, &old_range);
            let old_vertex = Vertex::Range(sheet, old_range_id);
            if let Some(deps) = executor.manager.graph.clone().get_deps(&old_vertex) {
                for dep in deps.iter() {
                    executor.manager.graph.remove_dep(&old_vertex, dep);
                }
            }
            let bcid =
                ctx.fetch_block_cell_id(&sheet, &block_id, r - master_row, c - master_col)?;
            executor =
                register_parsed_ast(executor, sheet, CellId::BlockCell(bcid), ast, ctx)?;
        }
    }
    Ok(executor)
}

pub fn remove_formula<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    row: usize,
    col: usize,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    let cell_id = ctx.fetch_cell_id(&sheet, row, col)?;
    remove(executor, sheet, cell_id, ctx)
}

pub fn remove_ephemeral_formula<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    id: EphemeralId,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    remove(executor, sheet, CellId::EphemeralCell(id), ctx)
}

fn remove<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet: SheetId,
    cell_id: CellId,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let range = match cell_id {
        CellId::NormalCell(normal) => Range::Normal(NormalRange::Single(normal)),
        CellId::BlockCell(block) => Range::Block(BlockRange::Single(block)),
        CellId::EphemeralCell(v) => Range::Ephemeral(v),
    };
    let range_id = ctx.fetch_range_id(&sheet, &range);
    let this_vertex = Vertex::Range(sheet, range_id);

    let FormulaManager {
        mut graph,
        mut formulas,
        names,
    } = executor.manager;
    if let Some(old_formula_deps) = graph.clone().get_deps(&this_vertex) {
        old_formula_deps.iter().for_each(|old_dep| {
            graph.remove_dep(&this_vertex, old_dep);
        })
    };
    if let CellId::BlockCell(bcid) = cell_id {
        graph.remove_dep(&Vertex::BlockAll(sheet, bcid.block_id), &this_vertex);
    }

    formulas.remove(&(sheet, cell_id));

    // Dropping a formula only detaches it from the dep graph — the calc engine
    // never revisits a formula-less cell, so the cell's last computed value
    // lingers in the container. For an ephemeral (shadow) cell that value is
    // meaningless without its formula (a validation/editability shadow whose
    // rule was cleared), and readers keying off shadow-id existence would keep
    // surfacing the stale warning / lock. Record it so the controller purges
    // the container value after formula execution. Normal / block cells are
    // left alone: their own value is user data, and the container executor
    // already clears them on `CellClear`.
    let mut ephemeral_shadows_cleared = executor.ephemeral_shadows_cleared;
    if let CellId::EphemeralCell(_) = cell_id {
        ephemeral_shadows_cleared.insert((sheet, cell_id));
    }

    Ok(FormulaExecutor {
        manager: FormulaManager {
            graph,
            formulas,
            names,
        },
        dirty_vertices: executor.dirty_vertices,
        dirty_ranges: executor.dirty_ranges,
        dirty_cubes: executor.dirty_cubes,
        dirty_blocks: executor.dirty_blocks,
        trigger: executor.trigger,
        ephemeral_shadows_cleared,
    })
}

fn input<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet: SheetId,
    cell_id: CellId,
    formula: String,
    substitute: Option<ast::Node>,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let parser = Parser {};
    let ast = if let Some(node) = substitute {
        parser.parse_with_substitude(&formula, &node, sheet, ctx)
    } else {
        parser.parse(&formula, sheet, ctx)
    };
    let Some(ast) = ast else { return Ok(executor) };
    register_parsed_ast(executor, sheet, cell_id, ast, ctx)
}

/// Register a pre-parsed AST as the formula for `cell_id`. Shared
/// between the user-facing `input` (text-formula path) and the
/// template-driven block-cell input path.
fn register_parsed_ast<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet: SheetId,
    cell_id: CellId,
    ast: ast::Node,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let range = match cell_id {
        CellId::NormalCell(normal) => Range::Normal(NormalRange::Single(normal)),
        CellId::BlockCell(block) => Range::Block(BlockRange::Single(block)),
        CellId::EphemeralCell(v) => Range::Ephemeral(v),
    };
    let range_id = ctx.fetch_range_id(&sheet, &range);
    let this_vertex = Vertex::Range(sheet, range_id);

    // Hard-reject any BLOCKREF / BLOCKREFS whose target block is
    // this formula cell's own block. Such a self-ref would create a
    // cycle with the topo-barrier edge `BlockAll(B) → cell`
    // registered below. Same-row sibling refs inside a templated
    // formula should use `#FIELD("name")` — it expands at template
    // instantiation time to a direct cell reference, no virtual
    // block vertex involved.
    if let CellId::BlockCell(bcid) = cell_id {
        if let Some(kind) = find_self_block_ref(&ast, sheet, bcid.block_id) {
            return Err(BasicError::InvalidFormula(format!(
                "{} targeting the cell's own block (sheet={}, block={}) \
                 is not allowed; use `#FIELD(\"...\")` for same-row \
                 sibling refs.",
                kind, sheet, bcid.block_id
            )));
        }
    }

    let mut new_formula_deps = HashSet::<Vertex>::new();
    get_all_vertices_from_ast(&ast, &mut new_formula_deps);

    let FormulaManager {
        mut graph,
        mut formulas,
        names,
    } = executor.manager;

    if let Some(old_formula_deps) = graph.clone().get_deps(&this_vertex) {
        old_formula_deps.iter().for_each(|old_dep| {
            graph.remove_dep(&this_vertex, old_dep);
        })
    };

    new_formula_deps.into_iter().for_each(|new_dep| {
        graph.add_dep(this_vertex.clone(), new_dep.clone());

        let range_deps = ctx.get_range_deps(&new_dep);
        range_deps.into_iter().for_each(|range_dep| {
            graph.add_dep(new_dep.clone(), range_dep);
        });
    });

    // Topo-barrier edge: every formula cell that lives inside a
    // block is registered as a dep of `BlockAll(block)`. Aggregators
    // like `=SUM(BLOCKREFS("X","*","f"))` depend on `BlockAll(X)`,
    // so this makes Tarjan compute every per-row formula in X BEFORE
    // the aggregator runs. It is also what bridges cross-block
    // propagation: after a block cell is recomputed, walking rdeps
    // reaches BlockAll(B), which reaches every external BLOCKREF
    // Single user.
    //
    // Cycle safety relies on `reject_self_block_ref` rejecting any
    // BLOCKREF whose target block equals the formula cell's own
    // block (`#FIELD("...")` is the supported way to express a
    // same-row sibling ref).
    if let CellId::BlockCell(bcid) = cell_id {
        graph.add_dep(Vertex::BlockAll(sheet, bcid.block_id), this_vertex.clone());
    }

    formulas.insert((sheet, cell_id), ast.clone());

    // Mark this formula's own vertex dirty so the end-of-tx calc pass
    // computes it on first registration. Without this, `register_parsed_ast`
    // only wires up the dep graph — the formula has no signal to
    // initially evaluate unless something upstream is also dirty in this
    // tx. That matters for templated block cells materialized by
    // `InsertRowsInBlock`: a newly-grown row's formulas (e.g. one whose
    // only deps are in *another* block, like BLOCKREF("Constants",...))
    // would otherwise register and immediately sit at empty forever.
    let mut dirty_vertices = executor.dirty_vertices;
    dirty_vertices.insert(this_vertex);

    // Setting a formula on an ephemeral cell (e.g. re-materializing a
    // validation/editability shadow with a new rule) supersedes any pending
    // clear for that same shadow in this transaction — the calc pass will
    // recompute it, so it must not be purged from the container.
    let mut ephemeral_shadows_cleared = executor.ephemeral_shadows_cleared;
    if let CellId::EphemeralCell(_) = cell_id {
        ephemeral_shadows_cleared.remove(&(sheet, cell_id));
    }

    Ok(FormulaExecutor {
        manager: FormulaManager {
            graph,
            formulas,
            names,
        },
        dirty_vertices,
        dirty_ranges: executor.dirty_ranges,
        dirty_cubes: executor.dirty_cubes,
        dirty_blocks: executor.dirty_blocks,
        trigger: executor.trigger,
        ephemeral_shadows_cleared,
    })
}

/// Materialize a block cell's value-formula template from the schema:
/// pull the template + the per-row sibling cell ids + the row's key
/// value, build a parse-time substitution closure for `#FIELD("name")`
/// and `#KEY`, parse, and register the resulting AST as the cell's
/// formula. No-op if the target cell isn't templated.
pub fn input_block_cell_template<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    block_id: BlockId,
    block_row: usize,
    block_col: usize,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    use std::collections::HashMap;
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    let bcid = ctx.fetch_block_cell_id(&sheet, &block_id, block_row, block_col)?;
    let Some(tpl) = ctx.block_cell_template(sheet, &bcid) else {
        return Ok(executor);
    };

    let siblings: HashMap<String, BlockCellId> = tpl.siblings.into_iter().collect();
    let key_node = ast::Node {
        pure: ast::PureNode::Value(ast::Value::Text(tpl.key_value)),
        bracket: false,
    };

    // Strip a leading `=` if the schema author included it. The parser
    // takes formula bodies, not `=`-prefixed forms.
    let body = tpl
        .template
        .strip_prefix('=')
        .map(|s| s.to_string())
        .unwrap_or(tpl.template);

    // Range ids the substitution itself introduces. They point into this
    // very block by design, so the own-block check below must not flag them.
    let mut substituted: HashSet<RangeId> = HashSet::new();
    let subs = resolve_field_placeholders(
        &body,
        sheet,
        &bcid,
        &siblings,
        // A value formula that resolves to its own cell is a self-loop.
        Some(&bcid),
        &mut substituted,
        ctx,
    )?;

    let parser = Parser {};
    let ast = parser.parse_with_substitutes(&body, sheet, ctx, &|kind| match kind {
        logisheets_parser::PlaceholderKind::FieldRef(..) => subs.get(&kind.to_owned()).cloned(),
        logisheets_parser::PlaceholderKind::Key => Some(key_node.clone()),
        // `#PLACEHOLDER` belongs to validation, not field templates;
        // leaving it untouched is harmless — surfaces as #NAME?.
        logisheets_parser::PlaceholderKind::Placeholder => None,
    });
    let Some(ast) = ast else { return Ok(executor) };

    // A field rule is a TEMPLATE: one string, instantiated verbatim for
    // every row of the block. It carries no cell anchor, so a coordinate
    // written inside it does NOT shift from row to row — `=C1+#FIELD("amt")`
    // means literally C1 in every single row.
    //
    // When that coordinate lands inside this same block it is always a
    // mistake, and a silent one: for the block's first row `C1` IS the cell
    // being defined, so it becomes a self-loop, and the cycle iterator
    // dutifully grinds it out to a garbage number (10 -> 10000 at
    // `iter_limit = 1000`) without an error anywhere. That is the coordinate
    // twin of the `BLOCKREF`-into-own-block case rejected in
    // `register_parsed_ast`, which slipped through because a bare
    // coordinate never builds a `BlockAll` vertex.
    //
    // Coordinates pointing OUTSIDE the block are left alone: a global
    // assumption cell really is the same cell for every row, which is
    // exactly what a template wants.
    let mut refs = Vec::new();
    collect_ref_ranges(&ast, &mut refs);
    for (ref_sheet, range_id) in refs {
        if ref_sheet != sheet || substituted.contains(&range_id) {
            continue;
        }
        if let Some(Range::Block(br)) = ctx.lookup_range(ref_sheet, range_id) {
            if br.block_id() == block_id {
                return Err(BasicError::InvalidFormula(format!(
                    "field rule {:?} references a cell inside its own block \
                     (sheet={}, block={}). A field rule is a template applied \
                     verbatim to every row, so a coordinate in it does not \
                     shift per row — on the block's first row it resolves to \
                     the very cell being defined. Use `#FIELD(\"name\")` for a \
                     same-row sibling. A cross-row reference (a running total \
                     reading the row above) has no template form; write that \
                     column as ordinary cells instead.",
                    body, sheet, block_id
                )));
            }
        }
    }

    register_parsed_ast(executor, sheet, CellId::BlockCell(bcid), ast, ctx)
}

/// Materialize a block cell's validation- or editability-formula
/// template from the schema onto a shadow cell of the matching kind.
///
/// Steps:
///   1. Read the field's rule template via `ctx.block_cell_shadow_template`.
///   2. Get-or-allocate the shadow id for `(sheet, cell, kind)`.
///   3. If the template is `Some`, parse with `#PLACEHOLDER` /
///      `#FIELD("name")` / `#KEY` substitutes and register the formula
///      on the ephemeral. If the template is `None` and a shadow already
///      exists, remove the formula so the rule effectively clears.
///
/// No-op when the cell isn't in a schema-bound block.
pub fn input_block_cell_shadow_template<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    block_id: BlockId,
    block_row: usize,
    block_col: usize,
    kind: crate::sid_assigner::ShadowKind,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    use std::collections::HashMap;
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    let bcid = ctx.fetch_block_cell_id(&sheet, &block_id, block_row, block_col)?;

    let template = ctx.block_cell_shadow_template(sheet, &bcid, kind);
    let row_ctx = ctx.block_cell_row_substitutes(sheet, &bcid);

    // Resolve the shadow id. When the template is absent we only need
    // to know if one exists (so we can clear it); when it's present we
    // allocate-or-reuse.
    let shadow_eid = match &template {
        Some(_) => Some(ctx.allocate_block_cell_shadow_id(sheet, &bcid, kind)),
        None => ctx.find_block_cell_shadow_id(sheet, &bcid, kind),
    };

    // No template + no existing shadow ⇒ nothing to do.
    let Some(eid) = shadow_eid else {
        return Ok(executor);
    };
    let shadow_cell = CellId::EphemeralCell(eid);

    let Some(template_str) = template else {
        // Template was cleared — strip any existing formula off the
        // shadow. Leaves the shadow id allocated (cheap) but no longer
        // computed. Host widgets reading the shadow's value will see
        // the last-computed value until something dirties it; in
        // practice ValidationCell treats "no formula" as "no warning".
        return remove(executor, sheet, shadow_cell, ctx);
    };

    // Build the per-row substitutes (siblings + key) the same way
    // input_block_cell_template does for value templates.
    let Some(row_ctx) = row_ctx else {
        return Ok(executor);
    };
    let siblings: HashMap<String, BlockCellId> = row_ctx.siblings.into_iter().collect();
    let key_node = ast::Node {
        pure: ast::PureNode::Value(ast::Value::Text(row_ctx.key_value)),
        bracket: false,
    };

    // `#PLACEHOLDER` resolves to the target cell of the shadow — i.e.
    // the block cell itself. Build the reference once.
    let placeholder_range = Range::Block(BlockRange::Single(bcid));
    let placeholder_range_id = ctx.fetch_range_id(&sheet, &placeholder_range);
    let placeholder_node = ast::Node {
        pure: ast::PureNode::Reference(ast::CellReference::Mut(RangeDisplay {
            range_id: placeholder_range_id,
            ref_abs: RefAbs::default(),
            sheet_id: sheet,
        })),
        bracket: true,
    };

    // Strip a leading `=` if the schema author included one.
    let body = template_str
        .strip_prefix('=')
        .map(|s| s.to_string())
        .unwrap_or(template_str);

    input_with_resolver(
        executor,
        sheet,
        shadow_cell,
        body,
        placeholder_node,
        bcid,
        siblings,
        key_node,
        ctx,
    )
}

// This method is only used in loading a file (especially for shared formula).
// So there are somethings different from inputting a formula.
pub fn add_ast_node(
    manager: &mut FormulaManager,
    sheet_id: SheetId,
    cell_id: CellId,
    range_id: RangeId,
    ast: ast::Node,
) {
    let this_vertex = Vertex::Range(sheet_id, range_id);
    let mut new_formula_deps = HashSet::<Vertex>::new();
    get_all_vertices_from_ast(&ast, &mut new_formula_deps);
    manager.formulas.insert((sheet_id, cell_id), ast);

    new_formula_deps
        .into_iter()
        .for_each(|new_dep| manager.graph.add_dep(this_vertex.clone(), new_dep));

    // The same topo-barrier edge the live path registers (see
    // `register_parsed_ast`): a formula cell inside a block becomes a dep of
    // `BlockAll(block)`.
    //
    // Omitting it here meant a saved workbook came back subtly broken. The
    // formulas loaded and evaluated once, so everything looked right — but
    // walking rdeps after a block cell recomputed never reached `BlockAll(B)`,
    // and so never reached the external `BLOCKREF` / `BLOCKREFS` readers of that
    // block. Change one input and the block updated while every summary cell
    // over it kept its old value: a wrong number, silently, and only after a
    // save/reload round trip.
    if let CellId::BlockCell(bcid) = cell_id {
        manager
            .graph
            .add_dep(Vertex::BlockAll(sheet_id, bcid.block_id), this_vertex);
    }
}

/// Post-load pass: add the Range→member-cell dependency edges for every formula
/// in the workbook. The file-load path (`add_ast_node`) records only the
/// formula→range edge and skips the range→member expansion the live path does
/// (`register_parsed_ast` via `ctx.get_range_deps`). It must run AFTER all
/// cells + ranges are registered, because a formula can reference a range whose
/// member cells load later (e.g. `D5=SUM(A5:B6)` is read before row 6). Without
/// these edges a range formula never recomputes when a member cell changes —
/// while a cell-ref (`=A1`) works, since its dep vertex IS the member cell.
/// Idempotent: `add_dep` is a set insert.
pub fn rebuild_range_deps<C: FormulaExecCtx>(manager: &mut FormulaManager, ctx: &C) {
    let mut deps = HashSet::<Vertex>::new();
    for ast in manager.formulas.values() {
        get_all_vertices_from_ast(ast, &mut deps);
    }
    for ast in manager.names.values() {
        get_all_vertices_from_ast(ast, &mut deps);
    }
    for dep in deps {
        for range_dep in ctx.get_range_deps(&dep) {
            manager.graph.add_dep(dep.clone(), range_dep);
        }
    }
}

/// Walk the AST looking for any `BLOCKREF` / `BLOCKREFS` whose target
/// `(sheet, block)` matches `(self_sheet, self_block)`. Returns the
/// human-readable kind ("BLOCKREF" / "BLOCKREFS") of the first match.
///
/// Used to enforce the "no self-block ref" invariant inside templated
/// formulas — see `register_parsed_ast`.
fn find_self_block_ref(
    ast: &ast::Node,
    self_sheet: SheetId,
    self_block: BlockId,
) -> Option<&'static str> {
    match &ast.pure {
        ast::PureNode::Func(func) => func
            .args
            .iter()
            .find_map(|n| find_self_block_ref(n, self_sheet, self_block)),
        ast::PureNode::Value(_) => None,
        ast::PureNode::ArrayConstant(_) => None,
        ast::PureNode::Reference(_) => None,
        ast::PureNode::BlockRef(node) => match node {
            ast::BlockRefNode::Single {
                sheet_id,
                block_id,
                key,
                ..
            } => {
                if *sheet_id == self_sheet && *block_id == self_block {
                    Some("BLOCKREF")
                } else {
                    find_self_block_ref(key, self_sheet, self_block)
                }
            }
            ast::BlockRefNode::Multi {
                sheet_id,
                block_id,
                key_condition,
                field_condition,
                ..
            } => {
                if *sheet_id == self_sheet && *block_id == self_block {
                    Some("BLOCKREFS")
                } else {
                    find_self_block_ref(key_condition, self_sheet, self_block)
                        .or_else(|| find_self_block_ref(field_condition, self_sheet, self_block))
                }
            }
        },
    }
}

/// Collect every range a parsed AST references *directly* — i.e. through
/// an A1/R1C1 coordinate rather than a `BLOCKREF`. Used by the template
/// path to check those coordinates against the block the formula lives
/// in; `BLOCKREF` self-refs are caught separately by
/// {@link find_self_block_ref}.
fn collect_ref_ranges(ast: &ast::Node, out: &mut Vec<(SheetId, RangeId)>) {
    match &ast.pure {
        ast::PureNode::Func(func) => func
            .args
            .iter()
            .for_each(|n| collect_ref_ranges(n, out)),
        ast::PureNode::Value(_) | ast::PureNode::ArrayConstant(_) => {}
        ast::PureNode::Reference(reference) => match reference {
            ast::CellReference::Mut(r) => out.push((r.sheet_id, r.range_id)),
            // Not in-sheet coordinates: a cube spans sheets, an external
            // ref another book, a defined name is resolved elsewhere, and
            // `#REF!` addresses nothing. None can be the own-block
            // coordinate mistake this collector exists to catch.
            ast::CellReference::UnMut(_)
            | ast::CellReference::Ext(_)
            | ast::CellReference::Name(_)
            | ast::CellReference::RefErr => {}
        },
        ast::PureNode::BlockRef(node) => match node {
            ast::BlockRefNode::Single { key, .. } => collect_ref_ranges(key, out),
            ast::BlockRefNode::Multi {
                key_condition,
                field_condition,
                ..
            } => {
                collect_ref_ranges(key_condition, out);
                collect_ref_ranges(field_condition, out);
            }
        },
    }
}

fn get_all_vertices_from_ast(ast: &ast::Node, vertices: &mut HashSet<Vertex>) {
    match &ast.pure {
        ast::PureNode::Func(func) => {
            func.args
                .iter()
                .for_each(|n| get_all_vertices_from_ast(n, vertices));
        }
        ast::PureNode::Value(_) | ast::PureNode::ArrayConstant(_) => {}
        ast::PureNode::Reference(reference) => match reference {
            ast::CellReference::Mut(r) => {
                let sheet_id = r.sheet_id;
                let range_id = r.range_id;
                let vertex = Vertex::Range(sheet_id, range_id);
                vertices.insert(vertex);
            }
            ast::CellReference::UnMut(c) => {
                let cube_id = c.cube_id;
                let vertex = Vertex::Cube(cube_id);
                vertices.insert(vertex);
            }
            ast::CellReference::Ext(ext_ref) => {
                let ext_ref_id = ext_ref.ext_ref_id;
                let vertex = Vertex::Ext(ext_ref_id);
                vertices.insert(vertex);
            }
            ast::CellReference::Name(name) => {
                let vertex = Vertex::Name(*name);
                vertices.insert(vertex);
            }
            ast::CellReference::RefErr => {}
        },
        ast::PureNode::BlockRef(node) => match node {
            ast::BlockRefNode::Single {
                sheet_id,
                block_id,
                field_id,
                key,
                ..
            } => {
                // Single-cell ref reacts to: that field column, the
                // key column (because the matching row depends on key
                // values), and any structural change to the block.
                //
                // `BlockAll(B)` is load-bearing for cross-block
                // propagation: when a cell inside B is recomputed via
                // cascade, the topo-barrier edge `BlockAll(B) → cell`
                // (registered in `register_parsed_ast` for every
                // formula cell inside B) means BlockAll(B) gets walked
                // in rdeps, which then reaches any external Single
                // user. The same-block self-ref that would otherwise
                // cycle is rejected by `reject_self_block_ref` below.
                vertices.insert(Vertex::Block(*sheet_id, *block_id, *field_id));
                vertices.insert(Vertex::BlockKey(*sheet_id, *block_id));
                vertices.insert(Vertex::BlockAll(*sheet_id, *block_id));
                get_all_vertices_from_ast(key, vertices);
            }
            ast::BlockRefNode::Multi {
                sheet_id,
                block_id,
                key_condition,
                field_condition,
                ..
            } => {
                // Multi scans an arbitrary subset of fields under runtime
                // filters; tracking exactly which fields survive the filter
                // is a future optimization. For correctness we depend on the
                // whole block (any field column, any key change, structural
                // change).
                vertices.insert(Vertex::BlockAll(*sheet_id, *block_id));
                vertices.insert(Vertex::BlockKey(*sheet_id, *block_id));
                get_all_vertices_from_ast(key_condition, vertices);
                get_all_vertices_from_ast(field_condition, vertices);
            }
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_all_vertices_from_ast() {
        // let f = "=B2*(1+A2)";
        let sum = ast::Node {
            pure: ast::PureNode::Func(ast::Func {
                op: ast::Operator::Infix(ast::InfixOperator::Plus),
                args: vec![
                    ast::Node {
                        pure: ast::PureNode::Value(ast::Value::Number(1.0)),
                        bracket: false,
                    },
                    ast::Node {
                        pure: ast::PureNode::Reference(ast::CellReference::Mut(
                            ast::RangeDisplay {
                                sheet_id: 0,
                                range_id: 0,
                                ref_abs: RefAbs::from_addr(false, false),
                            },
                        )),
                        bracket: false,
                    },
                ],
            }),
            bracket: false,
        };
        let ast = ast::Node {
            pure: ast::PureNode::Func(ast::Func {
                op: ast::Operator::Infix(ast::InfixOperator::Multiply),
                args: vec![
                    sum,
                    ast::Node {
                        pure: ast::PureNode::Reference(ast::CellReference::Mut(
                            ast::RangeDisplay {
                                sheet_id: 0,
                                range_id: 1,
                                ref_abs: RefAbs::from_addr(false, false),
                            },
                        )),
                        bracket: false,
                    },
                ],
            }),
            bracket: false,
        };

        let mut vertices = HashSet::<Vertex>::new();
        get_all_vertices_from_ast(&ast, &mut vertices);
        assert_eq!(vertices.len(), 2);
    }
}
