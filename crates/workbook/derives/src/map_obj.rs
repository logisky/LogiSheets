use syn::DeriveInput;

pub fn get_map_obj_impl_block(input: DeriveInput) -> proc_macro2::TokenStream {
    match input.data {
        syn::Data::Struct(data) => {
            let struct_name = input.ident;
            let fields = data.fields;
            let hash_ts = fields.iter().map(|f| {
                let ident = f.ident.as_ref().unwrap();
                let ty = &f.ty;
                if is_f64(ty) {
                    quote! {
                        let #ident = (self.#ident * 100.0).trunc() as u32;
                        #ident.hash(state);
                    }
                } else {
                    quote! {
                        self.#ident.hash(state);
                    }
                }
            });
            let partial_eq_ts = fields.iter().map(|f| {
                let ident = f.ident.as_ref().unwrap();
                quote! {
                    self.#ident == other.#ident
                }
            });
            quote! {
                impl std::hash::Hash for #struct_name {
                    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
                        #(#hash_ts)*
                    }
                }
                impl std::cmp::PartialEq for #struct_name {
                    fn eq(&self, other: &Self) -> bool {
                        #(#partial_eq_ts &&)* true
                    }
                }
                impl std::cmp::Eq for #struct_name {}
            }
        }
        syn::Data::Enum(_) => todo!(),
        syn::Data::Union(_) => todo!(),
    }
}

fn is_f64(ty: &syn::Type) -> bool {
    match ty {
        syn::Type::Path(p) => {
            let path = &p.path;
            match path.segments.iter().next() {
                Some(s) => {
                    if s.ident.to_string() == "f64" {
                        true
                    } else {
                        false
                    }
                }
                None => false,
            }
        }
        _ => false,
    }
}
