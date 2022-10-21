use num_bigint::BigUint;
use num_traits::One;

pub fn fact(n: u64) -> BigUint {
    let mut f1: BigUint = One::one();
    for n in 2..n + 1 {
        f1 *= n;
    }
    f1
}

pub fn factdouble(num: u64) -> u64 {
    if num <= 1 {
        1_u64
    } else {
        factdouble(num - 2) * num
    }
}

#[cfg(test)]
mod tests {
    use super::fact;
    use super::factdouble;

    #[test]
    fn fact_test() {
        let n = 0;
        assert_eq!(fact(n), 1u64.into());
        let n = 4;
        assert_eq!(fact(n), 24u64.into());
    }

    #[test]
    fn factdouble_test() {
        let n = 6;
        assert_eq!(factdouble(n), 48);
        let n = 7;
        assert_eq!(factdouble(n), 105);
    }
}
