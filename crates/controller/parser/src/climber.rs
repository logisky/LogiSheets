use std::collections::HashMap;
use std::iter::Peekable;

use pest::iterators::Pair;
use pest::RuleType;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[allow(dead_code)]
pub enum Assoc {
    Prefix,
    Left,
    Right,
    Postfix,
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct Operator<R: RuleType> {
    rule: R,
    assoc: Assoc,
    next: Option<Box<Operator<R>>>,
}

impl<R: RuleType> Operator<R> {
    pub fn new(rule: R, assoc: Assoc) -> Operator<R> {
        Operator {
            rule,
            assoc,
            next: None,
        }
    }
}

pub struct Climber<R: RuleType> {
    ops: HashMap<R, (u32, Assoc)>,
}

impl<R: RuleType> Climber<R> {
    pub fn climb<'i, P, F, G, T, M, N>(
        &self,
        pairs: P,
        mut primary: F,
        mut infix: G,
        mut prefix: M,
        mut suffix: N,
    ) -> T
    where
        P: Iterator<Item = Pair<'i, R>>,
        F: FnMut(Pair<'i, R>) -> T,
        G: FnMut(T, Pair<'i, R>, T) -> T,
        M: FnMut(Pair<'i, R>, T) -> T,
        N: FnMut(T, Pair<'i, R>) -> T,
    {
        self.expr(
            &mut pairs.peekable(),
            &mut primary,
            &mut infix,
            &mut prefix,
            &mut suffix,
            0,
        )
    }

    fn expr<'i, P, F, G, T, M, N>(
        &self,
        pairs: &mut Peekable<P>,
        primary: &mut F,
        infix: &mut G,
        prefix: &mut M,
        suffix: &mut N,
        prec: u32,
    ) -> T
    where
        P: Iterator<Item = Pair<'i, R>>,
        F: FnMut(Pair<'i, R>) -> T,
        G: FnMut(T, Pair<'i, R>, T) -> T,
        M: FnMut(Pair<'i, R>, T) -> T,
        N: FnMut(T, Pair<'i, R>) -> T,
    {
        let mut lhs = self.nud(pairs, primary, infix, prefix, suffix);
        while prec < self.lbp(pairs, primary, infix, prefix, suffix) {
            lhs = self.led(pairs, primary, infix, prefix, suffix, lhs);
        }

        lhs
    }

    pub fn nud<'i, P, F, G, T, M, N>(
        &self,
        pairs: &mut Peekable<P>,
        primary: &mut F,
        infix: &mut G,
        prefix: &mut M,
        suffix: &mut N,
    ) -> T
    where
        P: Iterator<Item = Pair<'i, R>>,
        F: FnMut(Pair<'i, R>) -> T,
        G: FnMut(T, Pair<'i, R>, T) -> T,
        M: FnMut(Pair<'i, R>, T) -> T,
        N: FnMut(T, Pair<'i, R>) -> T,
    {
        let pair = pairs.next().expect("");
        match self.ops.get(&pair.as_rule()) {
            Some((p, Assoc::Prefix)) => {
                let rhs = self.expr(pairs, primary, infix, prefix, suffix, *p - 1);
                prefix(pair, rhs)
            }
            None => primary(pair),
            _ => panic!(),
        }
    }

    fn lbp<'i, P, F, G, T, M, N>(
        &self,
        pairs: &mut Peekable<P>,
        _primary: &mut F,
        _infix: &mut G,
        _prefix: &mut M,
        _suffix: &mut N,
    ) -> u32
    where
        P: Iterator<Item = Pair<'i, R>>,
        F: FnMut(Pair<'i, R>) -> T,
        G: FnMut(T, Pair<'i, R>, T) -> T,
        M: FnMut(Pair<'i, R>, T) -> T,
        N: FnMut(T, Pair<'i, R>) -> T,
    {
        match pairs.peek() {
            Some(pair) => match self.ops.get(&pair.as_rule()) {
                Some((prec, _)) => *prec,
                None => panic!(),
            },
            None => 0,
        }
    }

    fn led<'i, P, F, G, T, M, N>(
        &self,
        pairs: &mut Peekable<P>,
        primary: &mut F,
        infix: &mut G,
        prefix: &mut M,
        suffix: &mut N,
        lhs: T,
    ) -> T
    where
        P: Iterator<Item = Pair<'i, R>>,
        F: FnMut(Pair<'i, R>) -> T,
        G: FnMut(T, Pair<'i, R>, T) -> T,
        M: FnMut(Pair<'i, R>, T) -> T,
        N: FnMut(T, Pair<'i, R>) -> T,
    {
        let pair = pairs.next().unwrap();
        match self.ops.get(&pair.as_rule()) {
            Some((_, Assoc::Postfix)) => suffix(lhs, pair),
            Some((prec, assoc)) => {
                let rhs = match *assoc {
                    Assoc::Left => self.expr(pairs, primary, infix, prefix, suffix, *prec),
                    Assoc::Right => self.expr(pairs, primary, infix, prefix, suffix, *prec - 1),
                    _ => panic!(),
                };
                infix(lhs, pair, rhs)
            }
            _ => panic!(),
        }
    }
}

pub struct ClimberBuilder<R: RuleType> {
    ops: HashMap<R, (u32, Assoc)>,
}

impl<R: RuleType> ClimberBuilder<R> {
    pub fn new() -> Self {
        ClimberBuilder {
            ops: HashMap::new(),
        }
    }

    pub fn op(mut self, op: Operator<R>) -> Self {
        let prec = self.ops.len() as u32;
        self.ops.insert(op.rule, (prec, op.assoc));
        self
    }

    pub fn build(self) -> Climber<R> {
        Climber { ops: self.ops }
    }
}
