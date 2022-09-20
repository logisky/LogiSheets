use std::{
    any::TypeId,
    collections::{HashMap, HashSet},
};

use crate::utils::remove_ext;

pub trait TS {
    fn _register(manager: &mut DescriptorManager) -> usize;
    fn _ts_name() -> String;
    fn _is_optional() -> bool {
        false
    }
}

#[derive(Default)]
pub struct DescriptorManager {
    pub descriptors: Vec<Descriptor>,
    pub id_map: HashMap<TypeId, usize>,
}

impl DescriptorManager {
    pub fn registry(&mut self, type_id: TypeId, descriptor: Descriptor) -> usize {
        match self.id_map.get(&type_id) {
            Some(idx) => *idx,
            None => {
                let idx = self.descriptors.len();
                self.descriptors.push(descriptor);
                self.id_map.insert(type_id, idx);
                idx
            }
        }
    }

    pub fn gen_data(self) -> Vec<(String, String)> {
        let mut result: Vec<(String, String)> = vec![];
        let descriptors = self.descriptors;
        descriptors.iter().for_each(|descriptor| match descriptor {
            Descriptor::Interface(d) => {
                let import_deps = d
                    .dependencies
                    .iter()
                    .fold(HashSet::new(), |mut prev, curr| {
                        let deps = get_import_deps_idx(&descriptors, *curr);
                        prev.extend(deps);
                        prev
                    });
                let import_string = {
                    let mut imports = import_deps.into_iter().fold(vec![], |mut prev, idx| {
                        let (ts_name, file_name) = get_import_deps(&descriptors, idx);
                        let s = format!("import {{{}}} from './{}'", ts_name, file_name);
                        prev.push(s);
                        prev
                    });
                    imports.sort();
                    let mut result = imports.join("\n");
                    if !imports.is_empty() {
                        result.push_str("\n");
                    }
                    result
                };
                let fields_strings = d.fields.iter().fold(Vec::<String>::new(), |mut prev, fd| {
                    let optional = if fd.optional {
                        String::from(" | null")
                    } else {
                        String::from("")
                    };
                    let ident = fd.ident.to_string();
                    let ty = fd.ts_ty.to_string();
                    let f = format!("    {}: {}{}", ident, ty, optional);
                    prev.push(f);
                    prev
                });
                let fields_string = fields_strings.join("\n");
                let content = format!(
                    "{}\nexport interface {} {{\n{}\n}}\n",
                    import_string,
                    d.ts_name.to_string(),
                    fields_string
                );
                result.push((d.file_name.to_string(), content))
            }
            Descriptor::Enum(e) => {
                let import_deps = e
                    .dependencies
                    .iter()
                    .fold(HashSet::new(), |mut prev, curr| {
                        let deps = get_import_deps_idx(&descriptors, *curr);
                        prev.extend(deps);
                        prev
                    });
                let import_string = {
                    let mut imports = import_deps.into_iter().fold(vec![], |mut prev, idx| {
                        let (ts_name, file_name) = get_import_deps(&descriptors, idx);
                        let s = format!("import {{{}}} from './{}'", ts_name, file_name);
                        prev.push(s);
                        prev
                    });
                    imports.sort();
                    let mut result = imports.join("\n");
                    if !imports.is_empty() {
                        result.push_str("\n");
                    }
                    result
                };
                let fields_strings = e.fields.iter().fold(Vec::<String>::new(), |mut prev, fd| {
                    let ident = fd.ident.to_string();
                    let ty = fd.ts_ty.to_string();
                    let f = if ty != "" {
                        format!("{{{}: {}}}", ident, ty)
                    } else {
                        format!(r#"'{}'"#, ident)
                    };
                    let f = format!("| {}", f);
                    prev.push(f);
                    prev
                });
                let fields_string = fields_strings.join("\n    ");
                let ts_name = e.ts_name.to_string();
                let content = format!(
                    "{}\nexport type {} =\n    {}\n",
                    import_string, ts_name, fields_string
                );
                result.push((e.file_name.to_string(), content))
            }
            _ => {}
        });
        result
    }
}

#[derive(Debug)]
pub enum Descriptor {
    Interface(InterfaceDescriptor),
    Enum(EnumDescriptor),
    BuiltinType(BuiltinTypeDescriptor),
    Generics(GenericDescriptor),
}

#[derive(Debug)]
pub struct GenericDescriptor {
    pub dependencies: Vec<usize>,
    pub ts_name: String,
    pub optional: bool,
}

#[derive(Debug)]
pub struct BuiltinTypeDescriptor {
    pub ts_name: String,
}

#[derive(Debug)]
pub struct EnumDescriptor {
    pub dependencies: Vec<usize>,
    pub fields: Vec<FieldDescriptor>,
    pub file_name: String,
    pub ts_name: String,
}

/// Describe how to generate a ts interface.
#[derive(Debug)]
pub struct InterfaceDescriptor {
    // The index of the descriptors in the manager.
    pub dependencies: Vec<usize>,
    pub fields: Vec<FieldDescriptor>,
    pub file_name: String,
    pub ts_name: String,
}

#[derive(Debug)]
pub struct FieldDescriptor {
    pub ident: String,
    pub optional: bool,
    pub ts_ty: String,
}

macro_rules! impl_builtin {
    ($i: ident, $l: literal) => {
        impl TS for $i {
            fn _register(manager: &mut DescriptorManager) -> usize {
                let type_id = TypeId::of::<$i>();
                let descriptor = BuiltinTypeDescriptor {
                    ts_name: $l.to_string(),
                };
                manager.registry(type_id, Descriptor::BuiltinType(descriptor))
            }

            fn _ts_name() -> String {
                $l.to_string()
            }
        }
    };
}

impl_builtin!(u8, "number");
impl_builtin!(u16, "number");
impl_builtin!(u32, "number");
impl_builtin!(u64, "number");
impl_builtin!(usize, "number");
impl_builtin!(i8, "number");
impl_builtin!(i32, "number");
impl_builtin!(i64, "number");
impl_builtin!(f32, "number");
impl_builtin!(f64, "number");
impl_builtin!(String, "string");
impl_builtin!(bool, "boolean");

impl<T: TS + 'static> TS for Vec<T> {
    fn _register(manager: &mut DescriptorManager) -> usize {
        let idx = T::_register(manager);
        let type_id = TypeId::of::<Self>();
        let descriptor = GenericDescriptor {
            dependencies: vec![idx],
            ts_name: Self::_ts_name(),
            optional: false,
        };
        manager.registry(type_id, Descriptor::Generics(descriptor))
    }

    fn _ts_name() -> String {
        format!("readonly {}[]", T::_ts_name())
    }
}

impl<T: TS + 'static> TS for Option<T> {
    fn _register(manager: &mut DescriptorManager) -> usize {
        let idx = T::_register(manager);
        let type_id = TypeId::of::<Self>();
        let descriptor = GenericDescriptor {
            dependencies: vec![idx],
            ts_name: Self::_ts_name(),
            optional: true,
        };
        manager.registry(type_id, Descriptor::Generics(descriptor))
    }

    fn _ts_name() -> String {
        T::_ts_name()
    }

    fn _is_optional() -> bool {
        true
    }
}

impl<K, V> TS for (K, V)
where
    K: TS + 'static,
    V: TS + 'static,
{
    fn _register(manager: &mut DescriptorManager) -> usize {
        let k_dep = K::_register(manager);
        let v_dep = V::_register(manager);
        let descriptor = GenericDescriptor {
            dependencies: vec![k_dep, v_dep],
            ts_name: Self::_ts_name(),
            optional: false,
        };
        let type_id = TypeId::of::<Self>();
        manager.registry(type_id, Descriptor::Generics(descriptor))
    }

    fn _ts_name() -> String {
        format!("(readonly [{}, {}])", K::_ts_name(), V::_ts_name())
    }
}

impl<K, V> TS for HashMap<K, V>
where
    K: TS + 'static,
    V: TS + 'static,
{
    fn _register(manager: &mut DescriptorManager) -> usize {
        let k_dep = K::_register(manager);
        let v_dep = V::_register(manager);
        let descriptor = GenericDescriptor {
            dependencies: vec![k_dep, v_dep],
            ts_name: Self::_ts_name(),
            optional: false,
        };
        let type_id = TypeId::of::<Self>();
        manager.registry(type_id, Descriptor::Generics(descriptor))
    }

    fn _ts_name() -> String {
        format!("Map<{}, {}>", K::_ts_name(), V::_ts_name())
    }
}

fn get_import_deps_idx(all: &Vec<Descriptor>, idx: usize) -> HashSet<usize> {
    let mut result = HashSet::new();
    let descriptor = all.get(idx).unwrap();
    match descriptor {
        Descriptor::Interface(_) => {
            result.insert(idx);
        }
        Descriptor::Enum(_) => {
            result.insert(idx);
        }
        Descriptor::BuiltinType(_) => {}
        Descriptor::Generics(d) => d.dependencies.iter().for_each(|dep| {
            let deps = get_import_deps_idx(all, *dep);
            result.extend(deps);
        }),
    };
    result
}

fn get_import_deps(all: &Vec<Descriptor>, idx: usize) -> (String, String) {
    let descriptor = all.get(idx).unwrap();
    match descriptor {
        Descriptor::Interface(d) => (d.ts_name.to_string(), remove_ext(&d.file_name)),
        Descriptor::Enum(d) => (d.ts_name.to_string(), remove_ext(&d.file_name)),
        _ => unreachable!(),
    }
}
