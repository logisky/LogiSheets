const PRECISION: f64 = 1e-7;
const NEWTON_MAX_ITERATION: u32 = 1000;

/// Newton iteration solver. `x` is the initial value.
pub fn newton<F>(x: f64, f: F) -> Option<f64>
where
    F: Fn(f64) -> f64,
{
    let mut x = x;
    let df = |x: f64| (f(x + PRECISION) - f(x - PRECISION)) / (2. * PRECISION);
    for _ in 1..NEWTON_MAX_ITERATION {
        let fx = f(x);
        let dfx = df(x);
        if dfx == 0.0 {
            return None;
        }
        let new_x = x - fx / dfx;
        if fx.abs() <= PRECISION || (new_x - x).abs() <= PRECISION {
            return Some(new_x);
        }
        x = new_x
    }
    None
}
