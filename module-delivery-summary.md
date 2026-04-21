# B1 已完成。以下是搭建的完整内容总结：

---

### 创建的文件

| 文件 | 说明 |
|---|---|
| `server/package.json` | 项目配置，含 express / cors / dotenv / openai 依赖，tsx watch 热重载脚本 |
| `server/tsconfig.json` | TypeScript 配置，面向 ES2022 + ESNext 模块 |
| `server/.env` | 环境变量（OPENAI_API_KEY、PORT、CORS 等），已被 gitignore |
| `server/.env.example` | 环境变量示例文件 |
| `server/src/config.ts` | 配置管理模块，从环境变量读取并校验必填项 |
| `server/src/index.ts` | Express 入口，含 CORS 中间件 + JSON 解析 + `/api/health` 健康检查端点 |

### 修改的文件

| 文件 | 变更 |
|---|---|
| `.gitignore` | 新增 `server/logs/` 忽略规则 |

### 已验证

- TypeScript 编译通过（`tsc --noEmit` 无错误）
- `npm run dev` 启动成功，监听 `http://localhost:3001`
- `/api/health` 端点返回 `{ status: "ok", env: "development" }`
- CORS 配置允许 `localhost:5173` 和 `localhost:5174`（Vite 默认端口）

B2: LLM 封装层已全部实现，TypeScript 编译通过，无 linter 错误。以下是实现总结：

---

# B2 已完成。以下是搭建的完整内容总结：

### 新增文件（8个）

**LLM 封装模块** (`server/src/llm/`)

- **`errors.ts`** — 5 个自定义错误类：`LLMError`（基类）、`LLMRateLimitError`（429限速）、`LLMParseError`（JSON解析失败，保留原始响应）、`LLMContentFilterError`（内容安全过滤）、`LLMEmptyResponseError`（空响应）

- **`logger.ts`** — 双通道日志系统：
  - 控制台：单行摘要（模型、耗时、token 用量、状态）
  - 文件：完整 JSON 条目写入 `server/logs/llm-{date}.jsonl`（仅开发模式启用）

- **`client.ts`** — OpenAI 客户端封装：
  - `chatCompletion()` — 文本生成，支持自定义 `responseFormat`（含 JSON Schema 模式）
  - `generateImage()` — DALL-E 图片生成
  - 指数退避重试（可配置次数、延迟），自动识别可重试错误（429/500/502/503/504/timeout）
  - 完整的错误包装与日志记录（成功和失败均记录）

- **`structured.ts`** — 结构化输出工具：
  - `structuredOutput<T>()` — 调用 GPT 并使用 OpenAI JSON Schema 模式，解析返回类型化结果
  - `defineSchema()` — 构建符合 OpenAI strict 模式要求的对象 schema（自动 `additionalProperties: false` + 全字段 `required`）
  - `enumSchema()` / `arraySchema()` — 辅助 schema 构建器

- **`index.ts`** — barrel 导出

**Prompt 模板模块** (`server/src/prompts/`)

- **`types.ts`** — Prompt 模板管理模式：
  - `PromptTemplate<TInput>` 接口：统一定义名称、输出 schema、消息构建函数、默认 LLM 选项
  - `executePrompt<TInput, TOutput>()` — 一键执行模板：构建消息 → 结构化输出调用 → 返回类型化结果
  - `system()` / `user()` / `assistant()` — 消息构建辅助函数

- **`story-skeleton.ts`** — 固定剧情骨架常量（`STORY_SKELETON` + `GENERATION_CONSTRAINTS`），包含世界背景、真实事件链、角色定义、物品分类规则、残缺念珠规则、线索类型、叙事约束等完整内容，供后续所有 AI 生成步骤共享

- **`index.ts`** — barrel 导出

---

### 后续任务使用方式

B3（探索工作流）和 B4（辩论工作流）可以这样使用 B2 提供的基础设施：

```typescript
import { system, user, executePrompt, type PromptTemplate } from '../prompts/index.js';
import { STORY_SKELETON, GENERATION_CONSTRAINTS } from '../prompts/index.js';
import { defineSchema, arraySchema, enumSchema } from '../llm/index.js';

const sceneTemplate: PromptTemplate<SceneInput> = {
  name: 'scene-skeleton',
  outputSchema: {
    name: 'scene_skeleton',
    schema: defineSchema({ /* ... */ }),
  },
  buildMessages: (input) => [
    system(STORY_SKELETON + '\n' + GENERATION_CONSTRAINTS),
    user(`请为本次游戏生成场景骨架...`),
  ],
};

const result = await executePrompt<SceneInput, SceneOutput>(sceneTemplate, input);
```