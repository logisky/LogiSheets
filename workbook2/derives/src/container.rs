use crate::symbol::VEC_SIZE;
use crate::symbol::{XML_SERDE, NAME, SKIP_SERIALIZING, SKIP_SERIALIZING_IF, TYPE};
use syn::parse::{self, Parse};
use proc_macro2::{Group, Span, TokenStream, TokenTree};
use syn::Meta::List;
use syn::Meta::NameValue;
use syn::Meta::Path;
use syn::NestedMeta::Meta;
use syn::NestedMeta::Lit;


pub struct Container<'a> {
    pub fields: Vec<Field<'a>>,
    pub original: &'a syn::DeriveInput,
}

impl<'a> Container<'a> {
    pub fn from_ast(
        item: &'a syn::DeriveInput,
        _derive: Derive,
    ) -> Container<'a> {
        match &item.data {
            syn::Data::Struct(ds) => {
                let fields = ds
                    .fields
                    .iter()
                    .map(|f| Field::from_ast(f))
                    .filter(|f| f.is_some())
                    .map(|f| f.unwrap())
                    .collect::<Vec<_>>();
                    Container {
                        fields,
                        original: item,
                    }
            },
            syn::Data::Enum(_) => todo!(),
            syn::Data::Union(_) => todo!(),
        }
    }
}

pub struct Field<'a> {
    pub ty: EleType,
    pub name: Option<syn::LitByteStr>,
    pub skip_serializing: bool,
    pub skip_serializing_if: Option<syn::ExprPath>,
    pub original: &'a syn::Field,
    pub vec_size: Option<syn::Lit>,
    pub vec_ty: Option<&'a syn::Type>,
}

impl<'a> Field<'a> {
    pub fn from_ast(f: &'a syn::Field) -> Option<Self> {
        let mut name = Option::<syn::LitByteStr>::None;
        let mut skip_serializing = false;
        let mut skip_serializing_if = Option::<syn::ExprPath>::None;
        let mut ty = Option::<EleType>::None;
        let mut vec_size = Option::<syn::Lit>::None;
        let mut vec_ty = Option::<&syn::Type>::None;
        for meta_item in f
            .attrs
            .iter()
            .flat_map(|attr| get_xmlserde_meta_items(attr))
            .flatten() {
            match meta_item {
                Meta(NameValue(m)) if m.path == NAME => {
                    if let Ok(s) = get_lit_byte_str(&m.lit) {
                        name = Some(s.clone());
                    }
                },
                Meta(NameValue(m)) if m.path == TYPE => {
                    if let Ok(s) = get_lit_str(&m.lit) {
                        let t = match s.value().as_str() {
                            "attr" => EleType::Attr,
                            "child" => EleType::Child,
                            "text" => EleType::Text,
                            _ => panic!(""),
                        };
                        ty = Some(t);

                    }
                }
                Meta(NameValue(m)) if m.path == VEC_SIZE => {
                    match m.lit {
                        syn::Lit::Str(_) | syn::Lit::Int(_) => {
                            vec_size = Some(m.lit);
                            let ty = get_vec_type(&f.ty).unwrap();
                            vec_ty = Some(ty);
                        },
                        _ => panic!(),
                    }
                }
                Meta(Path(word)) if word == SKIP_SERIALIZING => {
                    skip_serializing = true;
                }
                Meta(NameValue(m)) if m.path == SKIP_SERIALIZING_IF => {
                    if let Ok(path) = parse_lit_into_expr_path(&m.lit) {
                        skip_serializing_if = Some(path);
                    }
                }
                Meta(u) => {
                    let s = format!("UNKNOWNED xmlserde variant attribute");
                    // panic!("{}", s);
                }
                Lit(_) => unimplemented!(),
            }

        }
        if ty.is_none() {
            None
        } else {
            Some(Field {
                ty: ty.unwrap(),
                name,
                skip_serializing,
                skip_serializing_if,
                original: f,
                vec_size,
                vec_ty,
            })
        }
    }
}

/// Specify where this field is in the xml.
pub enum EleType {
    Attr,
    Child,
    Text,
}

pub enum Derive {
    Serialize,
    Deserialize,
}

fn get_xmlserde_meta_items(attr: &syn::Attribute) -> Result<Vec<syn::NestedMeta>, ()> {
    if attr.path != XML_SERDE {
        return Ok(Vec::new());
    }

    match attr.parse_meta() {
        Ok(List(meta)) => {
            Ok(meta.nested.into_iter().collect())
        },
        Ok(_) => {
            Err(())
            // panic!("expected #[xmlserde(...)]")
        },
        Err(_) => {
            Err(())
        }
    }
}

fn get_lit_byte_str<'a>(lit: &'a syn::Lit) -> Result<&'a syn::LitByteStr, ()> {
    if let syn::Lit::ByteStr(bl) = lit {
        Ok(bl)
    } else {
        Err(())
    }
}

fn get_lit_str<'a>(lit: &'a syn::Lit) -> Result<&'a syn::LitStr, ()> {
    if let syn::Lit::Str(lit) = lit {
        Ok(lit)
    } else {
        Err(())
    }
}


pub fn parse_lit_into_expr_path(lit: &syn::Lit) -> Result<syn::ExprPath, ()> {
    let string = get_lit_str(lit)?;
    match parse_lit_str(string) {
        Ok(r) => Ok(r),
        Err(_) => {
            let msg = format!("failed to parse path: {:?}", string.value());
            Err(())
            // panic!("{:?}", msg)
        },
    }
}

pub fn parse_lit_str<T>(s: &syn::LitStr) -> parse::Result<T>
where
    T: Parse,
{
    let tokens = spanned_tokens(s)?;
    syn::parse2(tokens)
}

fn spanned_tokens(s: &syn::LitStr) -> parse::Result<TokenStream> {
    let stream = syn::parse_str(&s.value())?;
    Ok(respan(stream, s.span()))
}

fn respan(stream: TokenStream, span: Span) -> TokenStream {
    stream
        .into_iter()
        .map(|token| respan_token(token, span))
        .collect()
}

fn respan_token(mut token: TokenTree, span: Span) -> TokenTree {
    if let TokenTree::Group(g) = &mut token {
        *g = Group::new(g.delimiter(), respan(g.stream(), span));
    }
    token.set_span(span);
    token
}

fn get_vec_type(t: &syn::Type) -> Option<&syn::Type> {
    match t {
        syn::Type::Path(p) => {
            let path = &p.path;
            match path.segments.last() {
                Some(seg) => {
                    if seg.ident.to_string() == "Vec" {
                        match &seg.arguments {
                            syn::PathArguments::AngleBracketed(a) => {
                                let args = &a.args;
                                if args.len() != 1 {
                                    None
                                } else {
                                    if let Some(syn::GenericArgument::Type(t)) = args.first() {
                                        Some(t)
                                    } else {
                                        None
                                    }
                                }
                            },
                            _ => None,
                        }
                    } else {
                        None
                    }
                },
                None => None,
            }
        },
        _ => None,
    }
}