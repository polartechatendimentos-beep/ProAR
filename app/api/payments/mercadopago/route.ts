import {NextRequest,NextResponse} from 'next/server';
import {paymentScope,context} from '@/lib/tenant-payments';
import {status,connect,create,reconcile,PaymentError} from '@/lib/tenant-payments-core';
import {readAuthBody,AuthRequestError} from '@/lib/auth-request-security';
export const runtime='nodejs';
function failure(e:unknown){return NextResponse.json({error:e instanceof PaymentError||e instanceof AuthRequestError?e.message:'Não foi possível concluir a operação de pagamento.'},{status:e instanceof PaymentError||e instanceof AuthRequestError?e.status:503,headers:{'Cache-Control':'no-store'}});}
export async function GET(r:NextRequest){try{const company=await paymentScope(r);return NextResponse.json(await status(context(company,r.nextUrl.origin)),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(r:NextRequest){try{const b=await readAuthBody(r),company=await paymentScope(r,true,b.action==='connect'),c=context(company,r.nextUrl.origin);const result=b.action==='connect'?await connect(c,b.accessToken,b.webhookSecret,b.live):b.action==='create'?await create(c,b.sourceId):b.action==='reconcile'?await reconcile(c,b.sourceId,undefined,typeof b.live==='boolean'?b.live:undefined):null;if(!result)throw new PaymentError('Operação inválida.');return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
