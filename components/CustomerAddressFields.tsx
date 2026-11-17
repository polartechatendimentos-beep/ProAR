'use client';
import {updateCustomerAddress,type CustomerAddress} from '@/lib/customer-address';
export function CustomerAddressFields({value,onChange}:{value:CustomerAddress;onChange:(patch:CustomerAddress)=>void}){
 const change=(field:keyof CustomerAddress,text:string)=>onChange(updateCustomerAddress(value,{[field]:text}));
 return <>
  <label>CEP<input autoComplete="postal-code" inputMode="numeric" maxLength={9} value={value.zipCode||''} onChange={e=>change('zipCode',e.target.value.replace(/\D/g,'').slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2'))} placeholder="00000-000"/></label>
  <label>Rua / Logradouro<input autoComplete="address-line1" value={value.street||''} onChange={e=>change('street',e.target.value)} placeholder="Rua, avenida ou estrada"/></label>
  <label>Número<input value={value.addressNumber||''} onChange={e=>change('addressNumber',e.target.value)} placeholder="Número ou S/N"/></label>
  <label>Complemento<input autoComplete="address-line2" value={value.complement||''} onChange={e=>change('complement',e.target.value)} placeholder="Apartamento, bloco, lote…"/></label>
  <label>Bairro<input value={value.neighborhood||''} onChange={e=>change('neighborhood',e.target.value)}/></label>
  <label>Cidade<input autoComplete="address-level2" value={value.city||''} onChange={e=>change('city',e.target.value)}/></label>
  <label>UF<input autoComplete="address-level1" maxLength={2} value={value.state||''} onChange={e=>change('state',e.target.value.replace(/[^a-z]/gi,'').toUpperCase())} placeholder="SP"/></label>
  <label className="wide budget-quick-wide">Endereço completo<input value={value.address||''} onChange={e=>change('address',e.target.value)} placeholder="Endereço consolidado para atendimento"/><small>Confira o endereço completo. Cadastros antigos são preservados até informar a rua.</small></label>
 </>;
}
