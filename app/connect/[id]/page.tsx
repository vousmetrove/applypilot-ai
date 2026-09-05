import ConnectClient from "./connect-client";
import { requireChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

async function ProtectedConnect({ pairingId, code, returnTo }: { pairingId: string; code: string; returnTo: string }) {
  await requireChatGPTUser(returnTo);
  return <ConnectClient pairingId={pairingId} code={code} />;
}

export default async function ConnectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { id } = await params;
  const { code = "" } = await searchParams;
  const returnTo = `/connect/${encodeURIComponent(id)}?code=${encodeURIComponent(code)}`;
  return <ProtectedConnect pairingId={id} code={code} returnTo={returnTo} />;
}
