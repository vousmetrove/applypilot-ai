import { env } from "cloudflare:workers";
import { corsJson, optionsResponse } from "@/lib/device-auth";
import { claimDevice } from "@/lib/pairing-core.mjs";
export function OPTIONS() { return optionsResponse(); }
export async function POST(request: Request, context: { params: Promise<{id:string}> }) {
  const {id}=await context.params;
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const result=await claimDevice(env.DB,id,String(body.code || ''),String(body.claimSecret || ''));
  return corsJson(result.body,result.status);
}