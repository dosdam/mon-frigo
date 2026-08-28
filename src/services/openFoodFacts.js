const ROOT='https://world.openfoodfacts.org/api/v3/product';
export async function findFood(barcode){
 const code=String(barcode||'').trim();
 if(!/^\d{8,40}$/.test(code))throw new Error('Code-barres invalide.');
 const fields='code,product_name,product_name_fr,generic_name,brands,quantity,image_front_small_url,categories';
 const r=await fetch(`${ROOT}/${encodeURIComponent(code)}.json?fields=${encodeURIComponent(fields)}`,{headers:{Accept:'application/json'}});
 if(!r.ok)throw new Error(`Open Food Facts indisponible (${r.status}).`);
 const data=await r.json();if(!data.product)return null;
 const p=data.product;const base=p.product_name_fr||p.product_name||p.generic_name||'';
 return{name:[base,p.brands].filter(Boolean).join(' - '),barcode:code,packageQuantity:p.quantity||'',imageUrl:p.image_front_small_url||'',categories:p.categories||'',source:'Open Food Facts'};
}
