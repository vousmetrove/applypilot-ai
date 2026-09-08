import {env} from 'cloudflare:workers';
import {generateRewrite} from '@/lib/rewrite-service.mjs';
type RewriteEnv={RESUME_AI_ENDPOINT?:string;RESUME_AI_MODEL?:string;RESUME_AI_API_KEY?:string;RESUME_REWRITE_LIMITER?:{limit(input:{key:string}):Promise<{success:boolean}>}};
export async function POST(request:Request) {
  const settings=env as unknown as RewriteEnv;
  const headers={'Cache-Control':'no-store'};
  if(!settings.RESUME_AI_API_KEY || !settings.RESUME_AI_ENDPOINT || !settings.RESUME_AI_MODEL || !settings.RESUME_REWRITE_LIMITER) return Response.json({error:'管理员尚未配置内容生成服务。可使用本机精简改写，或直接编辑优化稿。'}, {status:503,headers});
  if(Number(request.headers.get('Content-Length') || 0)>200000) return Response.json({error:'请求过大'},{status:413,headers});
  const key=request.headers.get('CF-Connecting-IP') || 'unidentified';
  if(!(await settings.RESUME_REWRITE_LIMITER.limit({key})).success) return Response.json({error:'请求过于频繁，请稍后重试'},{status:429,headers});
  try {
    const raw=await request.text();if(raw.length>200000) return Response.json({error:'请求过大'},{status:413,headers});
    const result=await generateRewrite(JSON.parse(raw),{endpoint:settings.RESUME_AI_ENDPOINT,model:settings.RESUME_AI_MODEL,apiKey:settings.RESUME_AI_API_KEY});
    return Response.json(result,{headers});
  } catch(error) {return Response.json({error:error instanceof Error ? error.message : '生成失败，请重试'},{status:422,headers});}
}
