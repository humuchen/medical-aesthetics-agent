/**
 * API 路径常量
 */

export const API_PATHS = {
  /** 聊天接口 */
  chat: '/api/chat',
  /** 权限响应接口 */
  permissionResponse: '/api/permission-response',
  /** 会话列表接口 */
  sessions: '/api/sessions',
  /** 模型列表接口 */
  models: '/api/models',
  /** 自定义模型接口 */
  customModels: '/api/custom-models',
  /** 检查登录状态 */
  checkLogin: '/api/check-login',
  /** 保存环境变量配置 */
  saveEnvConfig: '/api/save-env-config',
  /** 数据库统计 */
  dbStats: '/api/db-stats',
  /** 清空数据库 */
  dbClear: '/api/db/clear',
} as const;

/**
 * 外部链接
 */
export const EXTERNAL_URLS = {
  /** CodeBuddy CLI 设置文档 */
  codebuddyCliDocs: 'https://www.codebuddy.ai/docs/zh/cli/settings',
} as const;
