# AI 叙事推理游戏

基于 AI 动态生成的叙事推理游戏。前端 React + Vite，后端 Express，通过 DeepSeek / OpenRouter 调用大语言模型与图像生成模型，实现每局不同的故事、线索和画面。

## 环境要求

- **Node.js** 18+（推荐 20）
- 网络需能访问 `api.deepseek.com` 和 `openrouter.ai`（如需代理见下方说明）

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone https://github.com/htkira/ai-narrative-game.git
cd ai-narrative-game

# 前端依赖
npm install

# 后端依赖
cd server
npm install
cd ..
```

### 2. 配置环境变量

项目有两个 `.env.example` 模板，分别对应前端和后端，需要各复制一份为 `.env`。

**前端**（项目根目录）：

```bash
cp .env.example .env
```

编辑根目录 `.env`，将 `VITE_USE_REAL_API` 改为 `true`：

```env
VITE_USE_REAL_API=true
VITE_API_BASE_URL=http://localhost:3001
```

**后端**（server 目录）：

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`，填入 API Key：

```env
# DeepSeek（文本生成）
LLM_API_KEY=<DeepSeek API Key>
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat

# OpenRouter（图片生成）
OPENROUTER_API_KEY=<OpenRouter API Key>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-5.4
OPENROUTER_IMAGE_MODEL=google/gemini-3.1-flash-image-preview

# 代理（如网络可直连则留空）
HTTP_PROXY=

PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173
```

> **代理说明**：如果你的网络无法直接访问 DeepSeek / OpenRouter，需要在 `HTTP_PROXY` 填入本地代理地址，例如 `http://127.0.0.1:7890`。可直连则留空。

### 3. 启动

需要同时运行前端和后端，**打开两个终端**：

```bash
# 终端 1 — 启动后端
cd server
npm run dev
```

```bash
# 终端 2 — 启动前端
npm run dev
```

### 4. 开始游玩

浏览器打开 **http://localhost:5173** ，点击开始即可体验。

> AI 生成内容（文本 + 图片）需要一定等待时间，属正常现象。
