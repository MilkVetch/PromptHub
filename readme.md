# 🚀 Prompt Hub ｜轻量级 AI 灵感仓库

**[Prompt Hub](https://milkvetch.github.io/PromptHub/)** 是一款专为 AI 创作者（特别是 Suno 音乐人与大模型重度用户）设计的极简、高效 Prompt 管理工具。它利用 **GitHub Gist** 实现完全免费的私密云同步，让您的灵感在电脑与手机端无缝衔接。

---

## 🔒 核心声明：隐私与安全

1. **GitHub 账号依赖**：本工具通过 GitHub Gist 存储数据。**您必须拥有 GitHub 账号才能使用同步功能**。
2. **零服务器参与**：您的所有数据（提示词、Token、ID）仅存储在您的**浏览器本地**以及您**自己的 GitHub 私有仓库**中。
3. **完全私密**：除非您主动公开 Gist，否则您的内容默认仅对自己可见



## ✨ 产品特色（为什么选择PromptHub）

- **⚡️ 极致轻量**：基于单 HTML 文件架构，通过 CDN 加载 Tailwind CSS 和 Marked.js，无需安装任何插件或大型框架，秒速开启灵感记录。
- **📱 跨平台多端同步**：利用 GitHub Gist 作为私有云端，无论是在 PC 端还是移动端，只要配置好 Token 和 Gist ID，您的 Prompt 都能实现无缝同步。
- **📋 一键高效复制**：专为快速调用设计，在查看模式下提供显眼的一键复制按钮，让您的 Prompt 瞬间进入剪贴板，显著提升 AI 创作效率。
- **🔒 绝对的数据安全**：
  - **无中转服务器**：本工具不设后台服务器，所有数据直接通过 API 与 GitHub 通信。
  - **掌控权归你**：使用您自己的个人 GitHub Token 进行加密访问，数据存储在您名下的私密 Gist 中，网页仅作为一个纯前端的操作平台，隐私安全无忧。

---

## 🛠️ 配置指引：如何开启同步？

### 步骤 1：获取 GitHub Token (云端钥匙)
1. 登录 [GitHub](https://github.com/)。
2. 前往 **Settings** > **Developer settings** > **Personal access tokens (classic)**。
3. 点击 **Generate new token**，备注设为 `PromptHub`。
4. **关键**：在权限列表中勾选 **`gist`** 权限。
5. 生成并立即复制 Token（它只会出现一次）。

### 步骤 2：配置应用
1. 打开 [Prompt Hub](https://milkvetch.github.io/PromptHub/)，点击右上角 **⚙️ 同步设置**。
2. 粘贴 **GitHub Token**。
3. **首次使用**：Gist ID 留空，保存并创建第一个prompt后，系统会自动为您生成 ID。
4. **多端同步**：在其他设备上输入相同的 Token 和该 Gist ID 即可实现数据同步。

---

## 💡 进阶功能与操作

* **🎨 审美交互**：支持 Markdown 渲染。
* **🏗️ 2D 自由排序**：
    * **PC 端**：通过鼠标拖拽卡片，支持上下左右四个维度的精准插入。
    * **移动端**：长按卡片 0.6 秒触发微震反馈后即可自由移动。
* **📂 动态分类管理**：支持一键“重命名”整个分类下的所有条目。

---

## 📧 联系作者

如果您在使用中感受到便利，或希望进行打赏支持，请通过以下方式联系：

* **Email**: Khee.huang@hotmail.com
* **Wechat**: Khee Huang

---
© 2025 Khee. Crafted with ❤️ for AI music lovers.