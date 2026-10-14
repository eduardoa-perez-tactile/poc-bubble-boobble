// Exact recursive comparison: no omitted fields, reordering, or float tolerances.
export function match(expected:unknown,actual:unknown,path:string):void {
 if(Object.is(expected,actual))return;
 if(expected===null||actual===null||typeof expected!=='object'||typeof actual!=='object')throw new Error(`${path}: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`);
 const e=expected as Record<string,unknown>,a=actual as Record<string,unknown>;
 if(Array.isArray(e)!==Array.isArray(a))throw new Error(`${path}: collection type differs`);
 const ek=Object.keys(e).sort(),ak=Object.keys(a).sort();
 if(JSON.stringify(ek)!==JSON.stringify(ak))throw new Error(`${path}: keys differ ${JSON.stringify(ek)} / ${JSON.stringify(ak)}`);
 for(const key of ek)match(e[key],a[key],`${path}.${key}`);
}
