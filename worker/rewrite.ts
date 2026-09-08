import {generateRewrite} from '../lib/rewrite-service.mjs';
type Settings={RESUME_AI_ENDPOINT:string;RESUME_AI_MODEL:string;RESUME_AI_API_KEY:string;RESUME_REWRITE_LIMITER:{limit(input:{key:string}):Promise<{success:boolean}>}};
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const rewriteWorker = {
  async fetch(request:Request,env:Settings) {
    if(new URL(request.url).pathname!=='/api/resume/rewrite')return json({error:'Not found'},404);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    if(!env.RESUME_AI_API_KEY||!env.RESUME_AI_ENDPOINT||!env.RESUME_AI_MODEL||!env.RESUME_REWRITE_LIMITER)return json({error:'管理员尚未配置内容生成服务'},503);
    if(!(await env.RESUME_REWRITE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)return json({error:'请求过于频繁，请稍后重试'},429);
    if(Number(request.headers.get('Content-Length')||0)>200000)return json({error:'请求过大'},413);
    try {
      const raw=await request.text();if(raw.length>200000)return json({error:'请求过大'},413);
      return json(await generateRewrite(JSON.parse(raw),{endpoint:env.RESUME_AI_ENDPOINT,model:env.RESUME_AI_MODEL,apiKey:env.RESUME_AI_API_KEY}));
    }catch(error){return json({error:error instanceof Error?error.message:'内容生成失败'},422);}
  },
};
export default rewriteWorker;
