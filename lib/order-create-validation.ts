export function orderCreationIssue(input:{client:string;date:string;financialStatus?:string;draft:boolean}):string|null{
 if(!input.client.trim())return "Selecione o cliente na aba Geral e Agendamento.";
 if(input.financialStatus==="Bloqueado")return "O cliente está bloqueado financeiramente. Solicite a liberação antes de criar a OS.";
 if(!input.draft&&!/^\d{4}-\d{2}-\d{2}$/.test(input.date))return "Informe a data do atendimento na aba Geral e Agendamento, ou use Salvar como rascunho.";
 return null;
}
