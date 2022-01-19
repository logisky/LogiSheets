pub fn fact(num: u32) -> u32 {
    if num == 0 {
        1_u32
    } else {
        (1..num + 1).fold(1_u32, |prev, this| prev * this)
    }
}

pub fn factdouble(num: u32) -> u32 {
    if num <= 1 {
        1_u32
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
        assert_eq!(fact(n), 1);
        let n = 4;
        assert_eq!(fact(n), 24);
    }

    #[test]
    fn factdouble_test() {
        let n = 6;
        assert_eq!(factdouble(n), 48);
        let n = 7;
        assert_eq!(factdouble(n), 105);
    }
}
