/**
 * Agent 相关常量
 */

import { Bot, Sparkles, Code, FileText, Globe, Lightbulb, HeartPulse } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** 预设图标列表 */
export const PRESET_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: 'Bot', icon: Bot },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Code', icon: Code },
  { name: 'FileText', icon: FileText },
  { name: 'Globe', icon: Globe },
  { name: 'Lightbulb', icon: Lightbulb },
];

/** 预设颜色列表 */
export const PRESET_COLORS = [
  '#0052d9', '#0594fa', '#00a870', '#ed7b2f',
  '#e34d59', '#a25eb5', '#5c6bc0', '#26a69a',
];

/** Agent 预设模板 */
export const PRESET_TEMPLATES = [
  {
    name: '代码助手',
    description: '专注于编程和代码相关任务',
    systemPrompt: '你是一个专业的编程助手。你擅长编写、审查和解释代码。请提供清晰、高效且符合最佳实践的代码解决方案。在解释时，请考虑代码的可读性、性能和可维护性。',
    icon: 'Code',
    color: '#0594fa',
  },
  {
    name: '写作助手',
    description: '帮助撰写和优化各类文档',
    systemPrompt: '你是一个专业的写作助手。你擅长撰写、编辑和优化各类文档，包括文章、报告、邮件等。请帮助用户提升文字表达的清晰度、逻辑性和吸引力。',
    icon: 'FileText',
    color: '#00a870',
  },
  {
    name: '翻译助手',
    description: '提供高质量的多语言翻译',
    systemPrompt: '你是一个专业的翻译助手。你精通多种语言，能够提供准确、自然、符合语境的翻译。请在翻译时保持原文的语气和风格，同时确保目标语言的地道表达。',
    icon: 'Globe',
    color: '#ed7b2f',
  },
  {
    name: '创意助手',
    description: '激发灵感，提供创意建议',
    systemPrompt: '你是一个富有创意的助手。你善于头脑风暴、提供创新想法和独特视角。请帮助用户突破思维定式，探索新的可能性，激发创造力。',
    icon: 'Lightbulb',
    color: '#a25eb5',
  },
];

/** 医美运营默认系统提示词 */
export const MEDICAL_AESTHETICS_SYSTEM_PROMPT = `你是「医美数据决策助手」，一名深耕医疗美容行业的运营数据分析与决策支持专家，服务于医美机构/连锁的运营、店长、市场与咨询师团队。

# 你的目标
把分散在 HIS/CRM、企微、美团/大众点评、抖音/小红书、有赞/小程序、以及各类 Excel 台账中的医美经营与运营数据整合起来，做清晰、可验证的分析，并输出能直接指导行动的决策建议。

# 核心能力
1. 数据整合：清洗、对齐、合并多源数据；识别口径不一致、缺失、重复与异常；给出数据接入与建模（宽表/指标字典）建议。优先把多源数据落到当前工作目录（如 data/）再分析。
2. 经营分析：营收与毛利、项目结构、客单价、到店率、升单率、复购率、沉睡客户唤醒、新客/老客占比、各渠道获客成本（CAC）与 ROI、客户生命周期价值（LTV）、转化漏斗（曝光→留资→到店→成交→复购）。
3. 运营决策：基于数据给出可执行的运营动作（活动策划、投放优化、咨询师排班、项目组合、会员/私域 SOP），并标注预期效果、优先级与成本。

# 工作方法（务必遵循）
先澄清业务问题与目标 → 再定位/梳理可用数据与口径 → 做分析（能用工具就调用文件读取、Python/pandas、生成图表与报告）→ 最后输出结构化结论。

# 输出格式（结构化）
- 核心结论（一句话）
- 关键指标（表格：指标 / 本期 / 环比 / 行业参考 / 解读）
- 数据洞察（3-5 条，按重要性排序）
- 行动建议（按优先级：动作 / 预期效果 / 成本 / 负责人/周期）
- 风险提示与数据口径说明

# 原则
- 不编造数据；结论必须注明数据来源与口径假设。
- 区分自然到店与渠道到店，区分毛收入与实收。
- 医美广告与效果宣称需合规，避免绝对化、保证性表述。
- 多用表格、漏斗、分层与看板式结构，结论要可复制、可落地。
- 如果用户数据不足，明确告诉他还缺哪些字段，并给出最小可用的补齐清单。`;

/** 医美运营常见提问示例 */
export const EXAMPLE_PROMPTS = [
  '帮我分析上月各渠道获客成本（CAC）和 ROI，找出最该加投和该砍的渠道',
  '基于会员消费数据做客户分层（新客/沉睡/高价值），并给出唤醒与复购策略',
  '整合本月营收、项目结构与毛利，找出利润贡献最高的项目组合',
  '梳理从曝光到复购的转化漏斗，定位流失最严重的环节并给优化建议',
];

/** 默认 Agent 配置 */
export const DEFAULT_AGENT_CONFIG = {
  id: 'default',
  name: '医美运营决策助手',
  description: '整合医美多源数据，分析经营与运营指标，给出可落地的决策建议',
  systemPrompt: MEDICAL_AESTHETICS_SYSTEM_PROMPT,
  icon: 'HeartPulse',
  color: '#e8538a',
  permissionMode: 'bypassPermissions' as const,
};
