# Contributing to ApplyPilot

感谢你帮助改进简投。提交代码前，请先确认改动不会绕过用户确认、验证码、招聘网站声明或最终提交步骤。

## 开始贡献

1. Fork 仓库并克隆你的 Fork。
2. 从 `main` 创建分支，例如 `feature/moka-field-mapping`。
3. 安装依赖并运行开发环境。
4. 为行为变化补充或更新测试。
5. 运行 `npm run release:check`。
6. 提交 Pull Request，说明问题、解决方案、测试结果和隐私影响。

## 代码要求

- 不提交真实简历、身份证件、手机号、邮箱、令牌或招聘网站登录信息。
- 新增字段映射时，必须保留“用户确认后填写、永不自动提交”的边界。
- 不接入非官方个人微信机器人或模拟登录。
- 不使用欺骗性或绕过招聘平台安全措施的实现。
- 保持界面中文提示清楚，兼顾键盘和移动端使用。

## 提交问题

普通问题请使用 [GitHub Issues](https://github.com/vousmetrove/applypilot-ai/issues)。安全问题请按 `SECURITY.md` 私下报告。
