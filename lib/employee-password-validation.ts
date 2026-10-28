export function employeePasswordIssue(password:string,confirmation:string):{field:"password"|"confirmation";message:string}|null {
 if(!password&&!confirmation)return null;
 const missing:string[]=[];
 if(password.length<10)missing.push("pelo menos 10 caracteres");
 if(!/[A-Z]/.test(password))missing.push("uma letra maiúscula");
 if(!/[a-z]/.test(password))missing.push("uma letra minúscula");
 if(!/[0-9]/.test(password))missing.push("um número");
 if(missing.length)return {field:"password",message:"A nova senha precisa conter "+missing.join(", ")+"."};
 if(password!==confirmation)return {field:"confirmation",message:"A confirmação da senha não confere. Digite a mesma senha nos dois campos."};
 return null;
}
