import type {IntegrityResult} from "./integrity-audit";
export function integrityDashboard(report:IntegrityResult){
 const total=report.checks.length;
 const clean=report.checks.filter(x=>x.status==="OK").length;
 const score=total?Math.round(clean/total*100):100;
 const top=report.findings.slice().sort((a,b)=>a.severity==="Crítico"&&b.severity!=="Crítico"?-1:a.severity!==b.severity?1:0).slice(0,8);
 return {score,status:report.totals.critical?"critical":report.totals.attention?"attention":"healthy",critical:report.totals.critical,attention:report.totals.attention,clean,checks:total,top};
}
