export type CustomerAddress = {
  address?: string; zipCode?: string; street?: string; addressNumber?: string;
  complement?: string; neighborhood?: string; city?: string; state?: string;
};
/** Legacy full-text addresses are retained until the operator supplies a street. */
export function updateCustomerAddress<T extends CustomerAddress>(current:T, patch:Partial<CustomerAddress>):T {
  const next={...current,...patch};
  if(Object.hasOwn(patch,'address'))return next;
  if(!next.street?.trim())return next;
  next.address=[
    [next.street.trim(),next.addressNumber?.trim()].filter(Boolean).join(', '),
    next.complement?.trim(),next.neighborhood?.trim(),
    [next.city?.trim(),next.state?.trim()].filter(Boolean).join('/'),
    next.zipCode?.trim()?`CEP ${next.zipCode.trim()}`:'',
  ].filter(Boolean).join(' • ');
  return next;
}
