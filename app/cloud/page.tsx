import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Cloud() {
  await requireChatGPTUser('/cloud');
  redirect('/workspace.html?mode=cloud');
}
