use std::str::FromStr;

use num::complex::Complex;

pub fn build_complex(c: &str) -> Option<Complex<f64>> {
    let result = Complex::<f64>::from_str(c.trim());
    match result {
        Ok(complex) => Some(complex),
        Err(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use num::Complex;

    use super::build_complex;

    #[test]
    fn build_test() {
        let complex_str = "2.3+4i";
        let r = build_complex(complex_str).unwrap();
        assert_eq!(r, Complex::new(2.3, 4.));
        let complex_str = "2.3   -   4i";
        let r = build_complex(complex_str).unwrap();
        assert_eq!(r, Complex::new(2.3, -4.));
        let complex_str = "  2.3   -   4i  ";
        let r = build_complex(complex_str).unwrap();
        assert_eq!(r, Complex::new(2.3, -4.));
        let complex_str = "2.3+4j";
        let r = build_complex(complex_str).unwrap();
        assert_eq!(r, Complex::new(2.3, 4.));
        let complex_str = "2.3";
        let r = build_complex(complex_str).unwrap();
        assert_eq!(r, Complex::new(2.3, 0.));
    }
}
