pub fn convert_camel_from_snake(s: String) -> String {
    let mut result = String::new();
    let mut underline = false;
    for char in s.chars() {
        if char == '_' {
            underline = true;
            continue;
        }
        if underline {
            result.push(char.to_ascii_uppercase());
        } else {
            result.push(char);
        }
        underline = false;
    }
    result
}

pub fn convert_camel_from_pascal(s: String) -> String {
    if s.len() == 0 {
        return s;
    }
    let mut result = String::new();
    for (idx, char) in s.chars().enumerate() {
        if idx == 0 {
            result.push(char.to_ascii_lowercase());
        } else {
            result.push(char);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn convert_camel_from_snake_test() {
        let t1 = String::from("abc_def_gh");
        assert_eq!(convert_camel_from_snake(t1), "abcDefGh");
    }

    #[test]
    fn convert_camel_from_pascal_test() {
        let t1 = String::from("AbcDefGh");
        assert_eq!(convert_camel_from_pascal(t1), "abcDefGh");
    }
}
