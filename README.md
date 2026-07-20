# 医美数据决策 Agent

一个基于 **CodeBuddy Agent SDK** 构建的 Web Agent 应用，面向医美行业的**数据整合、经营分析、运营决策支持**场景，帮助运营、店长、市场与咨询师团队把分散的数据变成可落地的行动。

## 它解决什么问题

医美机构的数据往往散落在 HIS/CRM、企微、美团/大众点评、抖音/小红书、有赞/小程序以及各类 Excel 台账里，口径不一、难以联动。本应用通过内置的「医美运营决策助手」Agent，帮你：

- **数据整合**：清洗、对齐、合并多源数据；识别口径冲突、缺失与异常；给出数据接入与建模建议。
- **经营分析**：营收/毛利、客单价、到店率、升单率、复购率、沉睡客户唤醒、新客/老客占比、各渠道 CAC 与 ROI、LTV、转化漏斗（曝光→留资→到店→成交→复购）。
- **运营决策**：基于数据给出可执行的运营动作（活动、投放、咨询师排班、项目组合、会员/私域 SOP），并标注预期效果、优先级与成本。

默认 Agent 会按「核心结论 → 关键指标 → 数据洞察 → 行动建议 → 风险提示」的结构化格式输出，结论标注数据来源与口径，并遵循医美广告合规要求。

## 特性

- 💬 **流式对话** - 实时显示 AI 回复
- 🔧 **工具调用可视化** - 可看到 Agent 读取文件、运行 Python/pandas 分析、生成图表的过程
- 🔒 **权限控制** - 默认 Agent 使用 `bypassPermissions`，可直接分析工作目录中的业务数据（可在「设置」中调整）
- 📝 **会话管理** - 多会话切换、SQLite 持久化
- 🎨 **主题切换** - 深色/浅色主题
- 🤖 **自定义 Agent** - 在「设置」中创建更多细分场景 Agent（如「私域运营」「投放优化」「会员复购」）

## 技术栈

- **后端**: Node.js + Express + TypeScript
- **前端**: React 18 + TypeScript + Vite
- **UI**: TDesign React 组件库
- **AI**: CodeBuddy Agent SDK (`@tencent-ai/agent-sdk`)
- **数据库**: SQLite (better-sqlite3)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 CodeBuddy 凭证

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 `CODEBUDDY_API_KEY`（从 https://www.codebuddy.cn 获取）。
也可在应用启动后，通过「设置」页面的 Web UI 临时配置（仅当前进程有效）。

### 3. 启动开发服务器

```bash
npm run dev
```

同时启动前端（端口 5173）和后端（端口 3000）。

### 4. 访问应用

打开浏览器访问 http://localhost:5173

## 推荐的数据使用方式

默认 Agent 会在**工作目录**中读写文件进行数据分析。`data/` 目录已经放了一套示例数据（`members.csv` / `orders.csv` / `channels.csv`，见 `data/README.md` 的字段口径），可直接点选示例问题体验完整的数据整合→分析→决策链路；接入真实业务时，把对应文件替换为此处即可。

- “帮我分析上月各渠道获客成本（CAC）和 ROI，找出最该加投和该砍的渠道”
- “基于会员消费数据做客户分层，并给出唤醒与复购策略”
- “整合本月营收、项目结构与毛利，找出利润贡献最高的项目组合”
- “梳理从曝光到复购的转化漏斗，定位流失最严重的环节”

> 数据不足时，Agent 会明确告诉你还缺哪些字段，并给出最小可用的补齐清单。

## 项目结构

```
medical-aesthetics-agent/
├── server/                    # 后端服务
│   ├── index.ts              # Express + SSE 服务（含 Agent SDK 集成）
│   ├── index.d.ts
│   └── db.ts                 # SQLite 数据库操作
├── src/                      # 前端源码
│   ├── components/           # React 组件（含 NewChatView 示例提问）
│   ├── hooks/                # 自定义 Hooks（useAgents 内含默认 Agent 配置）
│   ├── pages/                # 页面组件
│   ├── utils/iconMap.ts      # 图标映射
│   ├── config.ts            # 应用名称/品牌配置
│   ├── types.ts             # 类型定义
│   └── App.tsx
├── data/                     # SQLite 数据库（运行时生成）
├── .env.example             # 环境变量模板
└── package.json
```

## 二次开发

如需自定义 Agent 的系统提示词、新增细分场景 Agent、调整 UI 或后端逻辑，请查看 [DEVELOPMENT.md](./DEVELOPMENT.md)。常用定制点：

- **默认 Agent 系统提示词**：`src/hooks/useAgents.ts` 中的 `MEDICAL_AESTHETICS_SYSTEM_PROMPT`
- **后端兜底提示词**：`server/index.ts` 中的 `defaultSystemPrompt`
- **应用品牌**：`src/config.ts`
- **欢迎页示例问题**：`src/components/NewChatView.tsx` 中的 `EXAMPLE_PROMPTS`

## License

MIT
