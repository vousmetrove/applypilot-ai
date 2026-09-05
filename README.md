# 简投 ApplyPilot

一份真实主档案，为每个岗位生成一版针对性简历，并在用户确认后辅助填写飞书招聘、Moka 和常见在线申请表。

> 当前状态：GitHub 公开版。浏览器扩展、设备配对、微信内 H5 进度页和表单辅助填写已经实现；浏览器商店上架、微信公众号自动回复及主动消息推送仍需要外部平台审核和官方凭据。

在线使用：[打开简投 ApplyPilot](https://applypilot-ai.meiqi011216.chatgpt.site)

![ApplyPilot 岗位工作台](public/screenshots/workspace.jpg)

## 项目说明

ApplyPilot 面向需要重复填写在线简历的求职者。用户只需维护一次主档案，之后可以：

- 分析岗位 JD，提取技能、关键词、优先级和硬性条件；
- 根据真实经历生成“一岗一版”的 ATS 友好简历；
- 导出岗位专属 Word 文件和结构化表单数据；
- 在本人确认后填写飞书招聘、Moka 和通用招聘表单；
- 通过二维码连接电脑浏览器与手机；
- 在微信内 H5 页面查看投递进度和电脑活动；
- 从手机发送受控任务，由电脑端再次确认执行。

本项目不是飞书、Moka 或微信的官方产品，也不绕过验证码、承诺声明或招聘网站安全机制。

## 安全边界

- 不自动点击最终提交，不进行无人确认的批量投递。
- 不填写密码、验证码、身份证件号码、签名和承诺声明。
- 不模拟个人微信登录，不读取微信聊天记录。
- 手机端只能创建“同步档案、打开申请页、分析当前页、填写当前页”四类任务。
- 除档案同步外，电脑端任务必须由用户点击“执行”。
- 简历优化只重排和改写已有真实信息，不虚构技能或经历。

## 技术结构

| 目录 | 作用 |
|---|---|
| `app/` | Vinext/Next 风格页面、认证页面和 API 路由 |
| `public/` | 主工作台、安装向导、微信 H5 页面和扩展下载包 |
| `extension/` | Manifest V3 浏览器扩展唯一源码 |
| `db/` | D1/SQLite 数据结构 |
| `drizzle/` | 数据库迁移文件 |
| `docs/` | 技术方案与产品边界说明 |
| `tests/` | 页面、扩展入口和组件测试 |

结构化记录使用 Cloudflare D1，附件使用 R2。当前认证实现使用 ChatGPT Sites 提供的登录和用户身份请求头。

## 前置要求

### 普通使用者

- 桌面版 Chrome、Microsoft Edge，或支持 Chromium 扩展的 QQ/夸克浏览器；
- ApplyPilot HTTPS 服务地址；使用官方公开部署时填写 `https://applypilot-ai.meiqi011216.chatgpt.site`；
- 手机微信，用于打开 H5 页面和扫描设备连接二维码。

### 开发与部署

- Node.js `22.13.0` 或更高版本；
- npm；
- Git；
- Windows PowerShell、Linux 或 macOS；
- 可选的受控安装及 ZIP 发布脚本需要 `bash`、`curl`、`flock`、GNU `timeout`、`zip` 和 `unzip`；Windows 可在 WSL2 中运行这些脚本；
- 支持 D1、R2 和用户身份请求头的 ChatGPT Sites/Cloudflare Workers 部署环境。

日常的 `npm ci`、`npm run dev`、`npm run build`、`npm run lint` 和 `npm test` 不需要 Bash。在 Windows PowerShell 如果 npm.ps1 被执行策略拦截，请使用 `npm.cmd` 替代 `npm`。

## 安装：普通使用者

### 方法一：从 GitHub Release 安装

1. 打开 [GitHub Releases](https://github.com/vousmetrove/applypilot-ai/releases)。
2. 下载 `applypilot-browser-assistant.zip`。
3. 将压缩包解压到不会被误删的位置，例如 `[文档/ApplyPilot]`。
4. 打开浏览器扩展管理页面：
   - Chrome：地址栏输入 `chrome://extensions`；
   - Edge：地址栏输入 `edge://extensions`；
   - QQ/夸克：打开“菜单 → 扩展程序”，具体入口取决于当前桌面版本。
5. 开启“开发者模式”。
6. 点击“加载已解压的扩展程序”。
7. 选择解压后的 `extension` 文件夹，该文件夹内应直接包含 `manifest.json`。
8. 将“简投 ApplyPilot 浏览器助手”固定到工具栏。

若浏览器商店版本已经审核通过，可直接使用 `[CHROME_WEB_STORE_URL]`、`[EDGE_ADDONS_URL]`、`[QQ_EXTENSION_STORE_URL]` 或 `[QUARK_EXTENSION_STORE_URL]`。

### 方法二：从源码安装扩展

```bash
git clone https://github.com/vousmetrove/applypilot-ai.git
cd applypilot-ai
npm run extension:check
```

然后在浏览器扩展管理页加载仓库中的 `extension/` 目录。

## 安装：开发者

### 1. 克隆项目

```bash
git clone https://github.com/vousmetrove/applypilot-ai.git
cd applypilot-ai
```

### 2. 创建本地部署配置

公开仓库不包含任何真实 Sites 项目 ID。本地开发和 CI 构建会自动读取示例绑定配置，无需创建站点。需要配置部署时再复制示例文件：

```bash
cp .openai/hosting.example.json .openai/hosting.json
```

使用 ChatGPT Sites 创建或关联站点后，由部署工具向本地 `hosting.json` 写入你自己的 `project_id`。不要把这个文件提交到 GitHub。

### 3. 安装依赖

Linux/WSL 推荐：

```bash
npm run install:ci
```

其他受支持环境可使用：

```bash
npm ci
```

### 4. 启动开发环境

```bash
npm run dev
```

终端显示本地地址后，在浏览器打开终端给出的链接，通常为 `http://localhost:5173`。

注意：本地页面可以用于界面和字段逻辑开发，但完整的多用户登录、D1/R2 持久化和设备扫码绑定需要部署环境提供身份请求头及真实存储绑定。

### 5. 生成数据库迁移

修改 `db/schema.ts` 后执行：

```bash
npm run db:generate
```

请检查生成的 SQL，再提交迁移和对应的 `drizzle/meta` 文件。

### 6. 构建和测试

```bash
npm run lint
npm test
npm run extension:check
```

发布前执行完整检查：

```bash
npm run release:check
```

该命令会运行代码检查、生产构建、自动化测试、扩展脚本语法检查、扩展打包和敏感信息扫描。

### 7. 打包扩展

```bash
npm run extension:package
```

生成文件：`public/applypilot-browser-assistant.zip`。

## 使用方法

### 1. 配置服务地址

1. 点击浏览器工具栏中的“简投”图标。
2. 在“简投服务地址”输入 `https://applypilot-ai.meiqi011216.chatgpt.site`；自行部署时替换为自己的 HTTPS 地址。
3. 点击“保存并授权连接”。
4. 浏览器显示域名访问权限时，核对域名并确认。

服务地址只保存在浏览器扩展本机存储中。更换地址会清除原设备令牌，需要重新配对。

### 2. 建立主档案

1. 登录 ApplyPilot 工作台。
2. 打开“主简历档案”。
3. 填写基本信息、求职意向、教育、主修课程、经历、项目、技能和成果。
4. 输入会实时保存在本机并同步云端。
5. 点击弹窗空白处或按 Esc 不会关闭编辑器。

### 3. 连接浏览器助手

1. 点击扩展中的“生成手机连接二维码”。
2. 用手机微信扫描二维码。
3. 登录后核对设备名称和权限范围。
4. 点击“确认连接这台电脑”。
5. 回到电脑，等待“主档案已自动同步”。

配对码有效期为10分钟。过期后请重新生成。

### 4. 根据 JD 生成简历

1. 在工作台填写公司、岗位名称并粘贴完整 JD。
2. 点击“分析岗位并生成简历”。
3. 检查匹配关键词、无证据关键词和硬性条件。
4. 打开“定向简历”检查内容。
5. 点击“导出 Word”。

### 5. 填写飞书或 Moka 表单

1. 打开招聘申请页面。
2. 点击浏览器扩展。
3. 点击“识别并填写当前页面”。
4. 检查绿色标记字段和缺失必填项。
5. 手动处理附件、验证码、承诺声明和最终提交。

页面结构可能随企业配置和平台更新变化。遇到无法识别的字段，请使用脱敏截图和示例 HTML 提交 Issue，不要上传真实简历或账号信息。

### 6. 微信内查看进度

1. 在微信中打开 `https://applypilot-ai.meiqi011216.chatgpt.site/wechat.html`。
2. 将页面发送到文件传输助手或加入收藏。
3. 页面每15秒更新投递记录、设备状态和电脑活动。
4. 手机可以发送受控任务；电脑端仍须确认执行。

微信公众号自动回复和订阅消息尚未默认启用。接入前需要已认证服务号/小程序、AppID、AppSecret、回调配置和消息模板审核。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动本地开发环境 |
| `npm run build` | 生成生产构建 |
| `npm test` | 构建并运行测试 |
| `npm run lint` | 运行代码规范检查 |
| `npm run db:generate` | 生成 Drizzle 数据库迁移 |
| `npm run extension:check` | 检查扩展 JavaScript 语法 |
| `npm run extension:package` | 生成扩展 ZIP |
| `npm run public:package` | 生成不含旧 Git 历史的公开源码 ZIP |
| `npm run release:check` | 执行完整公开发布检查 |

## 上传 GitHub：维护者

此开发仓库的早期本地提交曾包含私人部署标识。虽然当前版本已经移除这些内容，但不要直接把现有 `.git` 历史推送到公开仓库。请从清洁源码快照建立新的公开历史：

```bash
npm run release:check
npm run public:package
mkdir applypilot-public
unzip outputs/applypilot-ai-public-source.zip -d applypilot-public
cd applypilot-public/applypilot-ai
git init -b main
git add .
git commit -m "Initial public release"
git remote add origin https://github.com/vousmetrove/applypilot-ai.git
git push -u origin main
```

推送前再次确认 `git status` 中没有 `.env`、`.dev.vars` 或 `.openai/hosting.json`。GitHub 仓库创建时不要再自动生成 README、许可证或 `.gitignore`，避免首次推送产生冲突。

## 隐私与部署责任

官方公开部署的数据处理范围、保存与删除渠道见 [PRIVACY.md](PRIVACY.md)。自行部署者必须按自身运营主体、地区和基础设施更新该文件。

不要提交以下内容：

- 真实求职者简历或证件；
- `.env`、`.dev.vars`、访问令牌和私钥；
- 真实微信 AppSecret、EncodingAESKey；
- 招聘网站Cookie、密码或会话信息；
- 本地 `.openai/hosting.json`。

## 许可证

本项目采用 [MIT License](LICENSE)。你可以使用、修改和分发代码，但必须保留许可证中的版权和许可声明。

## 参与贡献

欢迎提交字段映射、平台兼容、无障碍和文档改进。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，并确保：

- 所有示例数据已脱敏；
- 不破坏“用户确认、永不自动提交”的安全边界；
- `npm run release:check` 通过；
- Pull Request 说明测试结果和隐私影响。

## 问题反馈与联系

- 功能问题与建议：[GitHub Issues](https://github.com/vousmetrove/applypilot-ai/issues)
- 安全问题：使用 [GitHub 私密安全报告](https://github.com/vousmetrove/applypilot-ai/security/advisories/new)，不要公开漏洞或个人数据

提交 Issue 时请提供浏览器版本、扩展版本、脱敏复现步骤和预期结果。不要发布真实姓名、手机号、邮箱、简历、证件或访问令牌。

## 发布前维护者清单

- [ ] 浏览器商店审核通过后替换商店链接
- [x] 选择并替换正式许可证
- [x] 补全隐私政策和私密安全联系入口
- [x] 创建 GitHub 公开仓库并配置 Issues、Dependabot 和私密安全报告文件
- [ ] 从 `outputs/applypilot-ai-public-source.zip` 新建 Git 历史，不推送现有开发历史
- [x] 配置公开部署地址及登录用户数据隔离策略
- [ ] 使用测试账号验证用户之间的数据隔离
- [ ] 上传 `applypilot-browser-assistant.zip` 到 GitHub Release
- [ ] 完成目标浏览器商店审核后替换商店链接
- [ ] 如需微信消息功能，完成官方认证、域名备案和模板审核

## 致谢

本项目使用 Vinext、React、Cloudflare Workers、D1、R2、Drizzle ORM 和 Manifest V3 浏览器扩展能力构建。
