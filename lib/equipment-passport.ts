export type EquipmentPassport={equipmentId:string;qrPayload:string;customerId?:string;location?:string;brand?:string;model?:string;serialNumber?:string;installedAt?:string;warrantyUntil?:string;refrigerant?:string;pmocNextDue?:string;serviceOrderIds:string[];maintenanceEvents:{at:string;type:string;serviceOrderId?:string;notes?:string}[];parts:{at:string;name:string;quantity:number;serviceOrderId?:string}[]};
export function equipmentPassportUrl(baseUrl:string,equipmentId:string){return baseUrl.replace(/\/$/,"")+"/equipamentos/"+encodeURIComponent(equipmentId)+"/passaporte";}
export function buildEquipmentPassport(input:Omit<EquipmentPassport,"qrPayload"> & {baseUrl:string}):EquipmentPassport{
 const {baseUrl,...rest}=input; return {...rest,qrPayload:equipmentPassportUrl(baseUrl,input.equipmentId)};
}
