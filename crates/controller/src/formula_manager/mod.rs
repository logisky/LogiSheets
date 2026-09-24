pub mod ctx;
mod executors;
pub mod graph;

use graph::Graph;
use imbl::HashMap;
use logisheets_base::{BlockFieldId, BlockId, CubeId, ExtRefId, NameId, RangeId, SheetId};
use logisheets_parser::ast;

use crate::CellId;

use self::ctx::FormulaExecCtx;
use self::executors::{add_ast_node, get_all_vertices_from_ast, rebuild_range_deps};
pub use executors::FormulaExecutor;

#[derive(Debug, Clone)]
pub struct FormulaManager {
    pub graph: Graph<Vertex>,
    pub formulas: HashMap<(SheetId, CellId), ast::Node>,
    pub names: HashMap<NameId, ast::Node>,
}

impl FormulaManager {
    pub fn new() -> Self {
        FormulaManager {
            graph: Graph::<Vertex>::new(),
            formulas: HashMap::new(),
            names: HashMap::new(),
        }
    }

    // Only used in loading a file. In a loading file process, we do not
    // need to find out the dirty vertex.
    pub fn add_ast_node(
        &mut self,
        sheet_id: SheetId,
        cell_id: CellId,
        range_id: RangeId,
        ast: ast::Node,
    ) {
        add_ast_node(self, sheet_id, cell_id, range_id, ast)
    }

    /// Rebuild Range→member-cell dependency edges for all formulas after a file
    /// load (see `executors::rebuild_range_deps`). Call once, after every cell
    /// and range is registered, so range formulas recompute correctly.
    pub fn rebuild_range_deps<C: FormulaExecCtx>(&mut self, ctx: &C) {
        rebuild_range_deps(self, ctx)
    }

    /// Install `ast` as what defined name `id` refers to.
    ///
    /// `Vertex::Name(id)` is wired to every vertex the definition reads, the
    /// same way a formula cell is, so a change under the name reaches every
    /// formula that uses it through the ordinary rdeps walk. The caller dirties
    /// `Vertex::Name(id)` when the definition itself changed.
    pub fn set_name<C: FormulaExecCtx>(&mut self, id: NameId, ast: ast::Node, ctx: &C) {
        self.unlink_name(id);
        let this = Vertex::Name(id);
        let mut deps = std::collections::HashSet::<Vertex>::new();
        get_all_vertices_from_ast(&ast, &mut deps);
        for dep in deps {
            self.graph.add_dep(this.clone(), dep.clone());
            for range_dep in ctx.get_range_deps(&dep) {
                self.graph.add_dep(dep.clone(), range_dep);
            }
        }
        self.names.insert(id, ast);
    }

    /// Drop a name's definition. Formulas using it keep their edge to
    /// `Vertex::Name(id)`, so defining it again brings them back.
    pub fn remove_name(&mut self, id: NameId) -> bool {
        self.unlink_name(id);
        self.names.remove(&id).is_some()
    }

    fn unlink_name(&mut self, id: NameId) {
        let this = Vertex::Name(id);
        if let Some(deps) = self.graph.get_deps(&this).cloned() {
            deps.iter().for_each(|d| self.graph.remove_dep(&this, d));
        }
    }

    /// True when `ast`, followed through the definitions of the names it
    /// uses, reaches name `target`. Defining `target` as `ast` would then make
    /// it refer to itself, which has no value.
    pub fn name_reaches(&self, ast: &ast::Node, target: NameId) -> bool {
        let mut stack = vec![];
        collect_names(ast, &mut stack);
        let mut seen = std::collections::HashSet::new();
        while let Some(n) = stack.pop() {
            if n == target {
                return true;
            }
            if !seen.insert(n) {
                continue;
            }
            if let Some(def) = self.names.get(&n) {
                collect_names(def, &mut stack);
            }
        }
        false
    }
}

fn collect_names(ast: &ast::Node, out: &mut Vec<NameId>) {
    match &ast.pure {
        ast::PureNode::Func(func) => func.args.iter().for_each(|a| collect_names(a, out)),
        ast::PureNode::Reference(ast::CellReference::Name(n)) => out.push(*n),
        ast::PureNode::BlockRef(ast::BlockRefNode::Single { key, .. }) => collect_names(key, out),
        ast::PureNode::BlockRef(ast::BlockRefNode::Multi {
            key_condition,
            field_condition,
            ..
        }) => {
            collect_names(key_condition, out);
            collect_names(field_condition, out);
        }
        _ => {}
    }
}

/// Vertex of the formula dependency graph.
///
/// `Block`, `BlockKey`, `BlockAll` are virtual nodes — they don't correspond
/// to a cell that gets recomputed. Instead they fan dirty propagation into
/// the BlockRef formulas that depend on them. Dirtying happens at the
/// formula-executor level, side-channel from cell writes (see
/// `executors/mod.rs::execute`), because the set of cells in a block can
/// change dynamically and we don't want to maintain explicit graph edges for
/// each block-cell.
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum Vertex {
    Range(SheetId, RangeId),
    Cube(CubeId),
    Ext(ExtRefId),
    Name(NameId),
    /// One field-column (or field-row) of a single block. Dirtied when any
    /// cell in that field changes.
    Block(SheetId, BlockId, BlockFieldId),
    /// The key column/row of a block. Dirtied when any key cell changes —
    /// reorders or relabels can flip which row a `BLOCKREF(_, key, _)`
    /// resolves to.
    BlockKey(SheetId, BlockId),
    /// The entire block. Dirtied on structural changes (bind/rebind, row
    /// or field added/removed). Also used as the catch-all dependency for
    /// `BLOCKREFS` since its filters scan multiple fields.
    BlockAll(SheetId, BlockId),
}

impl Ord for Vertex {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        match (self, other) {
            (Vertex::Range(_, r1), Vertex::Range(_, r2)) => r1.cmp(r2),
            (Vertex::Cube(c1), Vertex::Cube(c2)) => c1.cmp(c2),
            (Vertex::Ext(e1), Vertex::Ext(e2)) => e1.cmp(e2),
            (Vertex::Name(n1), Vertex::Name(n2)) => n1.cmp(n2),
            (Vertex::Range(_, _), _) => std::cmp::Ordering::Less,
            (Vertex::Name(_), _) => std::cmp::Ordering::Less,
            (Vertex::Cube(_), _) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        }
    }
}

impl PartialOrd for Vertex {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}
