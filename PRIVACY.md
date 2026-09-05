# Privacy Policy

生效日期：2026-09-04

本说明适用于由 GitHub 用户 `vousmetrove` 维护的 ApplyPilot 公开部署。自行部署者是其部署环境中的独立数据控制者，应按当地法律替换本文件中的运营信息。

ApplyPilot 会处理简历档案、求职记录和用户主动上传的申请材料。只有登录用户可以访问自己的云端数据；应用通过平台提供的稳定用户标识隔离不同用户的数据。

## 当前数据处理方式

- 主档案先保存在浏览器本机，再同步到登录用户的云端空间。
- 结构化记录存储在 D1，上传文件存储在 R2。
- 浏览器设备令牌以哈希形式保存在服务端，并可由用户撤销。
- 浏览器活动只记录产品事件，不记录招聘网站密码或微信聊天内容。
- 浏览器扩展不自动上传附件、不绕过验证码、不点击最终提交。

## 数据保存与删除

- 数据默认保存至用户主动删除或提出删除请求，不会用于训练公开模型或出售给第三方。
- 如需删除账户相关数据，请通过 [GitHub 私密安全报告](https://github.com/vousmetrove/applypilot-ai/security/advisories/new) 提交标题为 `ApplyPilot data deletion request` 的私密请求；不要在公开 Issue 中填写姓名、简历或证件信息。
- 维护者目标是在收到可验证的请求后 30 日内完成处理或说明无法处理的原因。
- 托管由 ChatGPT Sites 及其 Cloudflare Workers、D1、R2 基础设施提供，数据可能由平台在其运营区域内处理，不承诺固定在单一国家或地区。

## 第三方处理者

- OpenAI ChatGPT Sites：身份登录、站点托管和请求分发；
- Cloudflare：Workers 运行环境、D1 结构化存储和 R2 文件存储；
- 招聘网站：仅在用户当前打开的页面内接收用户确认填写的数据，ApplyPilot 不代表招聘网站处理其后续数据。

## 联系与更新

一般问题请使用 [GitHub Issues](https://github.com/vousmetrove/applypilot-ai/issues)。涉及漏洞、删除请求或个人信息时，请使用 GitHub 私密安全报告。隐私说明发生实质变化时，将通过仓库提交记录更新生效日期。

不得把示例简历、测试身份证件或真实候选人数据提交到 GitHub。
