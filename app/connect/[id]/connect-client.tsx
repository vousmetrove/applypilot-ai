"use client";

import { useState } from "react";
import Link from "next/link";

type State = "ready" | "working" | "success" | "error";

export default function ConnectClient({ pairingId, code }: { pairingId: string; code: string }) {
  const [state, setState] = useState<State>("ready");
  const [message, setMessage] = useState("仅授权这台浏览器读取你的主档案；不会读取微信聊天，也不会自动提交申请。");

  async function confirm() {
    setState("working");
    setMessage("正在安全连接设备……");
    try {
      const response = await fetch(`/api/device/pairings/${encodeURIComponent(pairingId)}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "连接失败");
      setState("success");
      setMessage(data.message || "授权成功，请回到电脑浏览器。");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "连接失败，请重新生成配对码。");
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] px-5 py-10 text-[#eaf1f8] grid place-items-center">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1d31] p-7 shadow-2xl">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#27d7c4] text-lg font-black text-[#07111f]">简</span>
          <div><p className="m-0 font-bold">简投设备连接</p><p className="m-0 mt-1 text-sm text-[#8fa4bb]">手机授权 · 电脑执行 · 随时撤销</p></div>
        </div>
        <p className="text-sm leading-7 text-[#b9c8d8]">电脑名称</p>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base font-semibold">[当前浏览器助手]</div>
        <p className="mt-5 text-sm leading-6 text-[#9eb1c5]">{message}</p>
        {state === "success" ? (
          <div className="mt-6 rounded-xl border border-[#27d7c4]/30 bg-[#27d7c4]/10 p-4 text-sm text-[#7ee8d9]">✓ 已授权。电脑端将在几秒内自动显示“已连接”。</div>
        ) : (
          <button onClick={confirm} disabled={state === "working"} className="mt-6 min-h-12 w-full rounded-xl bg-[#27d7c4] px-4 font-extrabold text-[#07111f] disabled:opacity-60">
            {state === "working" ? "连接中…" : state === "error" ? "重新授权" : "确认连接这台电脑"}
          </button>
        )}
        <div className="mt-6 border-t border-white/10 pt-5 text-xs leading-6 text-[#8196ad]">
          <p>不会获得：微信聊天记录、招聘网站密码、验证码、身份证号码。</p>
          <p>最终提交、承诺声明与附件上传始终需要本人确认。</p>
        </div>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#5f8cff]">返回简投工作台</Link>
      </section>
    </main>
  );
}
