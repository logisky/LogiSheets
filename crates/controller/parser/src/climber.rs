use std::collections::HashMap;
use std::iter::Peekable;

use pest::RuleType;
use pest::iterators::Pair;

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
    /// Binding power. Operators in the SAME tier (e.g. `*` and `/`, or `+` and
    /// `-`) MUST share a precedence so they evaluate left-to-right; a higher
    /// number binds tighter.
    prec: u32,
    assoc: Assoc,
    next: Option<Box<Operator<R>>>,
}

impl<R: RuleType> Operator<R> {
    pub fn new(rule: R, prec: u32, assoc: Assoc) -> Operator<R> {
        Operator {
            rule,
            prec,
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
        // An empty stream has no pair to hand `primary`, so there is no value
        // to return and this one genuinely cannot degrade. The grammar always
        // yields at least one pair for an expression; the message is here so a
        // future grammar change is diagnosable rather than an empty panic.
        let pair = pairs
            .next()
            .expect("climber: expression with no tokens — grammar guarantees at least one");
        match self.ops.get(&pair.as_rule()) {
            Some((p, Assoc::Prefix)) => {
                let rhs = self.expr(pairs, primary, infix, prefix, suffix, *p - 1);
                prefix(pair, rhs)
            }
            None => primary(pair),
            // An expression starting with an infix or postfix operator. The
            // grammar rejects those before we get here, so reaching this means
            // the grammar and the operator table have drifted apart. Treat the
            // token as a primary and let the visitor make of it what it will —
            // a malformed formula should surface as a formula error, not take
            // the engine's thread down.
            Some(_) => primary(pair),
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
                // Not an operator where one was expected. Binding power 0 ends
                // the climb, exactly as end-of-input does, rather than panicking
                // on a token the operator table doesn't know.
                None => 0,
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
        let pair = match pairs.next() {
            Some(pair) => pair,
            // `led` is only entered after `lbp` peeked a token, so the stream
            // cannot be empty here; yield the left side rather than unwrapping.
            None => return lhs,
        };
        match self.ops.get(&pair.as_rule()) {
            Some((_, Assoc::Postfix)) => suffix(lhs, pair),
            Some((prec, assoc)) => {
                let rhs = match *assoc {
                    // A prefix operator in infix position. Unreachable via the
                    // grammar; bind it like every other infix operator in the
                    // table rather than dying on it.
                    Assoc::Right => self.expr(pairs, primary, infix, prefix, suffix, *prec - 1),
                    Assoc::Left | Assoc::Prefix | Assoc::Postfix => {
                        self.expr(pairs, primary, infix, prefix, suffix, *prec)
                    }
                };
                infix(lhs, pair, rhs)
            }
            // A non-operator in operator position — `lbp` returned 0 for it, so
            // the climb should already have stopped. Keep the left side and let
            // the stray token be ignored instead of panicking.
            None => lhs,
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
        self.ops.insert(op.rule, (op.prec, op.assoc));
        self
    }

    pub fn build(self) -> Climber<R> {
        Climber { ops: self.ops }
    }
}
