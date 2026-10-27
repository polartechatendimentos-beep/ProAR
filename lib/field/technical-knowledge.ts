import {assessTechnicalEvidence,type TechnicalQuery} from './technical-diagnosis.ts';
export const TECHNICAL_PROCEDURES=[
 {id:'vacuo',title:'Vácuo e desidratação',keywords:['vacuo','microns','desidratacao'],guidance:'Conferir o procedimento do fabricante; utilizar vacuômetro calibrado e registrar pressão absoluta e teste de subida. Não usar somente tempo de bomba como critério.',source:'Procedimento interno de referência; confirmar manual oficial.'},
 {id:'estanqueidade',title:'Teste de estanqueidade',keywords:['estanqueidade','nitrogenio','vazamento','pressurizacao'],guidance:'Isolar componentes conforme fabricante; usar nitrogênio seco com regulador; verificar limites de pressão, temperatura e duração do ensaio; registrar leituras. Nunca pressurizar com oxigênio.',source:'Procedimento interno de referência; confirmar manual oficial.'},
 {id:'eletrica',title:'Segurança elétrica',keywords:['eletrica','tensao','placa','disjuntor','choque'],guidance:'Desenergizar, bloquear e sinalizar; verificar ausência de tensão com instrumento apropriado; seguir procedimentos de segurança e documentação do fabricante.',source:'Procedimento interno de referência; confirmar plano de segurança e documentação.'},
];
export function answerTechnicalQuestion(input:TechnicalQuery){
 const intake=assessTechnicalEvidence(input,false),q=intake.query.symptoms.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=TECHNICAL_PROCEDURES.map(p=>({...p,score:p.keywords.filter(k=>q.includes(k)).length})).filter(p=>p.score>0).sort((a,b)=>b.score-a.score),match=matches[0];
 return {success:true,mode:'assisted_knowledge_search',aiEnabled:false,answer:match?match.guidance:'Não há documentação técnica homologada suficiente para responder. Informe fabricante, modelo exato, código e sintoma; confira o manual oficial e medições verificadas.',sources:match?[{title:match.title,reference:match.source}]:[],needsTechnicianVerification:true,diagnosticIntake:intake,nextQuestions:intake.missing,diagnosticStatus:'NOT_CONFIRMED',notice:'Consulta por regras e procedimentos internos. Não usa IA generativa, não confirma defeito nem autoriza reparo.'};
}
