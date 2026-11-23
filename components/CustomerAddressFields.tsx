'use client';
import {useState} from 'react';
import {updateCustomerAddress,type CustomerAddress} from '@/lib/customer-address';
export function CustomerAddressFields({value,onChange}:{value:CustomerAddress;onChange:(patch:CustomerAddress)=>void}){
 const [cepLookup,setCepLookup]=useState('');
 const change=(field:keyof CustomerAddress,text:string)=>onChange(updateCustomerAddress(value,{[field]:text}));
 const lookupCep=async()=>{
  const cep=String(value.zipCode||'').replace(/\D/g,'');
  if(cep.length!==8)return;
  setCepLookup('Consultando CEP…');
  try{
   const response=await fetch('https://brasilapi.com.br/api/cep/v2/'+cep,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});
   if(!response.ok)throw new Error(response.status===404?'CEP não encontrado. Confira os números.':'Consulta temporariamente indisponível. Preencha o endereço manualmente.');
   const result=await response.json() as {street?:string;neighborhood?:string;city?:string;state?:string};
   onChange(updateCustomerAddress(value,{street:result.street||value.street||'',neighborhood:result.neighborhood||value.neighborhood||'',city:result.city||value.city||'',state:result.state||value.state||''}));
   setCepLookup('Endereço preenchido pelo CEP. Confira o número e complemento.');
  }catch(error){setCepLookup(error instanceof Error?error.message:'Não foi possível consultar o CEP.');}
 };
 return <>
  <label>CEP<input autoComplete="postal-code" inputMode="numeric" maxLength={9} value={value.zipCode||''} onChange={e=>{setCepLookup('');change('zipCode',e.target.value.replace(/\D/g,'').slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2'));}} onBlur={()=>void lookupCep()} placeholder="00000-000"/><small role="status">{cepLookup||'Preencha o CEP para localizar rua, bairro e cidade.'}</small></label>
  <label>Rua / Logradouro<input autoComplete="address-line1" value={value.street||''} onChange={e=>change('street',e.target.value)} placeholder="Rua, avenida ou estrada"/></label>
  <label>Número<input value={value.addressNumber||''} onChange={e=>change('addressNumber',e.target.value)} placeholder="Número ou S/N"/></label>
  <label>Complemento<input autoComplete="address-line2" value={value.complement||''} onChange={e=>change('complement',e.target.value)} placeholder="Apartamento, bloco, lote…"/></label>
  <label>Bairro<input value={value.neighborhood||''} onChange={e=>change('neighborhood',e.target.value)}/></label>
  <label>Cidade<input autoComplete="address-level2" value={value.city||''} onChange={e=>change('city',e.target.value)}/></label>
  <label>UF<input autoComplete="address-level1" maxLength={2} value={value.state||''} onChange={e=>change('state',e.target.value.replace(/[^a-z]/gi,'').toUpperCase())} placeholder="SP"/></label>
  <label className="wide budget-quick-wide">Endereço completo<input value={value.address||''} onChange={e=>change('address',e.target.value)} placeholder="Endereço consolidado para atendimento"/><small>Confira o endereço completo. Cadastros antigos são preservados até informar a rua.</small></label>
 </>;
}
