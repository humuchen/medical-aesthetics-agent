/**
 * localStorage 键名常量
 */

export const STORAGE_KEYS = {
  /** 聊天输入框草稿 */
  draftInput: 'draftInput',
  /** 会话模型选择缓存 */
  sessionModels: 'sessionModels',
  /** 自定义 Agent 列表 */
  customAgents: 'customAgents',
  /** 默认模型 */
  defaultModel: 'defaultModel',
  /** 默认 Agent ID */
  defaultAgentId: 'defaultAgentId',
  /** 默认工作目录 */
  defaultCwd: 'defaultCwd',
} as const;
