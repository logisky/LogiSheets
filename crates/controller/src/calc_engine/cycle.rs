use std::collections::HashSet;

use im::hashmap::HashMap;
use logisheets_base::{Addr, NameId};
use logisheets_parser::ast;

use super::calculator::calculator::calc;
use crate::vertex_manager::vertex::FormulaId;

use super::{
    calculator::calc_vertex::{CalcValue, Value},
    connector::Connector,
};

pub struct CycleCalculator<'a, C>
where
    C: Connector,
{
    pub vertices: Vec<FormulaId>,
    pub error: f32,
    pub iter_limit: u16,
    pub connector: &'a mut C,
    pub names: &'a HashMap<NameId, ast::Node>,
    pub formulas: &'a HashMap<FormulaId, ast::Node>,
}

impl<'a, C> CycleCalculator<'a, C>
where
    C: Connector,
{
    pub fn start(self) -> HashSet<FormulaId> {
        let mut times = 0_u16;
        let mut finish = false;
        let connector = self.connector;
        let formulas = self.formulas;
        let error = self.error;
        let mut last_calc = vec![CalcValue::Scalar(Value::Blank); self.vertices.len()];
        let mut dirties = HashSet::<FormulaId>::new();
        while times < self.iter_limit && !finish {
            let mut this_calc = Vec::<CalcValue>::with_capacity(self.vertices.len());
            self.vertices
                .iter()
                .for_each(|fid| match formulas.get(fid) {
                    Some(node) => {
                        let curr_sheet = fid.0;
                        let curr_addr = connector
                            .get_cell_idx(curr_sheet, &fid.1)
                            .map_or(Addr::default(), |(row, col)| Addr { row, col });
                        connector.set_curr_cell(curr_sheet, curr_addr);
                        let res = calc(node, connector);
                        let dirty = connector.commit_calc_values(fid.clone(), res.clone());
                        dirties.extend(dirty);
                        this_calc.push(res);
                    }
                    None => this_calc.push(CalcValue::Scalar(Value::Blank)),
                });
            if last_calc
                .iter()
                .zip(this_calc.iter())
                .all(|(l, t)| meet_error(l, t, error))
            {
                finish = true;
            }
            times += 1;
            last_calc = this_calc;
        }
        dirties
    }
}

fn meet_error(v1: &CalcValue, v2: &CalcValue, error: f32) -> bool {
    match (v1, v2) {
        (CalcValue::Scalar(s1), CalcValue::Scalar(s2)) => match (s1, s2) {
            (Value::Blank, Value::Blank) => true,
            (Value::Number(n1), Value::Number(n2)) => (*n1 - *n2).abs() < error as f64,
            (Value::Text(t1), Value::Text(t2)) => t1 == t2,
            (Value::Boolean(b1), Value::Boolean(b2)) => *b1 == *b2,
            (Value::Error(e1), Value::Error(e2)) => e1 == e2,
            (Value::Date(d1), Value::Date(d2)) => d1 == d2,
            _ => false,
        },
        (CalcValue::Range(_), CalcValue::Range(_)) => true,
        (CalcValue::Cube(_), CalcValue::Cube(_)) => true,
        _ => false,
    }
}
