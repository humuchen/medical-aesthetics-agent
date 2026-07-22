import { createClient, LibsqlError } from '@libsql/client';
import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate, PermissionResult, CanUseTool } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";

// 创建 Turso 数据库客户端
// Vercel 环境必须配置 TURSO_DATABASE_URL，否则使用 /tmp 作为临时数据库（不持久化）
function getDatabaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }
  // Vercel 环境使用 /tmp（数据不持久化，仅用于测试）
  if (process.env.VERCEL) {
    console.warn('[DB] Warning: Using /tmp database - data will NOT persist between requests!');
    console.warn('[DB] Please configure TURSO_DATABASE_URL for production.');
    return 'file:/tmp/chat.db';
  }
  // 本地开发使用 data 目录
  return 'file:./data/chat.db';
}

const db = createClient({
  url: getDatabaseUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 初始化数据库表
async function initDatabase() {
  try {
    // 逐条执行 DDL（Turso HTTP 模式下 executeBatch 可能不稳定）
    await db.execute(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      sdk_session_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      model TEXT,
      created_at TEXT NOT NULL,
      tool_calls TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )`);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`);

    await db.execute(`CREATE TABLE IF NOT EXISTS custom_models (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      provider TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    // 迁移：添加 sdk_session_id 列（如果不存在）
    try {
      const tableInfo = await db.execute("PRAGMA table_info(sessions)");
      const hasColumn = tableInfo.rows.some(col => col.name === 'sdk_session_id');
      if (!hasColumn) {
        await db.execute("ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT");
        console.log("[DB] Added sdk_session_id column to sessions table");
      }
    } catch (e) {
      // 忽略错误（列可能已存在）
    }

    console.log("[DB] Database initialized successfully");
  } catch (error) {
    console.error("[DB] Initialization error:", error);
    throw error; // 抛出错误，让调用方知道初始化失败
  }
}

// 数据库初始化状态
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

// 确保数据库已初始化（懒加载模式）
async function ensureDatabaseInitialized(): Promise<void> {
  if (dbInitialized) return;

  // 使用 Promise 缓存避免并发初始化
  if (!dbInitPromise) {
    dbInitPromise = initDatabase();
  }

  await dbInitPromise;
  dbInitialized = true;
}

// 启动时尝试初始化（不阻塞，但请求时会等待）
initDatabase().then(() => {
  dbInitialized = true;
}).catch(err => {
  console.error("[DB] Startup init failed:", err);
});

// 类型定义
export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  created_at: string;
  tool_calls: string | null;
}

export interface DbCustomModel {
  id: string;
  model_id: string;
  name: string;
  description: string | null;
  provider: string;
  base_url: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

// ============= 会话操作 =============

// 获取所有会话
export async function getAllSessions(): Promise<DbSession[]> {
  const result = await db.execute('SELECT * FROM sessions ORDER BY updated_at DESC');
  return result.rows as DbSession[];
}

// 获取单个会话
export async function getSession(id: string): Promise<DbSession | undefined> {
  const result = await db.execute({
    sql: 'SELECT * FROM sessions WHERE id = ?',
    args: [id],
  });
  return result.rows[0] as DbSession | undefined;
}

// 创建会话
export async function createSession(session: DbSession): Promise<DbSession> {
  await db.execute({
    sql: `INSERT INTO sessions (id, title, model, sdk_session_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [session.id, session.title, session.model, session.sdk_session_id, session.created_at, session.updated_at],
  });
  return session;
}

// 更新会话
export async function updateSession(id: string, updates: Partial<Pick<DbSession, 'title' | 'model' | 'sdk_session_id'>>): Promise<boolean> {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.model !== undefined) {
    fields.push('model = ?');
    values.push(updates.model);
  }
  if (updates.sdk_session_id !== undefined) {
    fields.push('sdk_session_id = ?');
    values.push(updates.sdk_session_id);
  }
  
  if (fields.length === 0) return false;
  
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  
  const result = await db.execute({
    sql: `UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`,
    args: values,
  });
  return result.rowsAffected > 0;
}

// 删除会话
export async function deleteSession(id: string): Promise<boolean> {
  const result = await db.execute({
    sql: 'DELETE FROM sessions WHERE id = ?',
    args: [id],
  });
  return result.rowsAffected > 0;
}

// ============= 消息操作 =============

// 获取会话的所有消息
export async function getMessagesBySession(sessionId: string): Promise<DbMessage[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
    args: [sessionId],
  });
  return result.rows as DbMessage[];
}

// 创建消息
export async function createMessage(message: DbMessage): Promise<DbMessage> {
  await db.execute({
    sql: `INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [message.id, message.session_id, message.role, message.content, message.model, message.created_at, message.tool_calls],
  });
  
  // 更新会话的 updated_at
  await db.execute({
    sql: 'UPDATE sessions SET updated_at = ? WHERE id = ?',
    args: [new Date().toISOString(), message.session_id],
  });
  
  return message;
}

// 更新消息内容
export async function updateMessage(id: string, updates: Partial<Pick<DbMessage, 'content' | 'tool_calls'>>): Promise<boolean> {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.tool_calls !== undefined) {
    fields.push('tool_calls = ?');
    values.push(updates.tool_calls);
  }
  
  if (fields.length === 0) return false;
  
  values.push(id);
  
  const result = await db.execute({
    sql: `UPDATE messages SET ${fields.join(', ')} WHERE id = ?`,
    args: values,
  });
  return result.rowsAffected > 0;
}

// 删除消息
export async function deleteMessage(id: string): Promise<boolean> {
  const result = await db.execute({
    sql: 'DELETE FROM messages WHERE id = ?',
    args: [id],
  });
  return result.rowsAffected > 0;
}

// 批量创建消息（用于保存对话）
export async function createMessages(messages: DbMessage[]): Promise<void> {
  // libsql 不支持事务批量执行，逐条插入
  for (const msg of messages) {
    await db.execute({
      sql: `INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [msg.id, msg.session_id, msg.role, msg.content, msg.model, msg.created_at, msg.tool_calls],
    });
  }
}

// 清空所有数据
export async function clearAllData(): Promise<void> {
  await db.execute('DELETE FROM messages');
  await db.execute('DELETE FROM sessions');
  await db.execute('DELETE FROM custom_models');
}

// 获取数据库统计信息
export async function getDbStats(): Promise<{
  sessions: number;
  messages: number;
  customModels: number;
  dbSizeKB: number;
  tables: string[];
}> {
  const sessionResult = await db.execute('SELECT COUNT(*) as count FROM sessions');
  const messageResult = await db.execute('SELECT COUNT(*) as count FROM messages');
  const customModelResult = await db.execute('SELECT COUNT(*) as count FROM custom_models');

  const sessionCount = (sessionResult.rows[0] as any)?.count || 0;
  const messageCount = (messageResult.rows[0] as any)?.count || 0;
  const customModelCount = (customModelResult.rows[0] as any)?.count || 0;

  // 获取表列表
  const tablesResult = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const tables = tablesResult.rows.map(t => t.name as string);

  return {
    sessions: sessionCount,
    messages: messageCount,
    customModels: customModelCount,
    dbSizeKB: 0, // 无法在云端获取文件大小
    tables,
  };
}

// ============= 自定义模型操作 =============

// 获取所有自定义模型
export async function getAllCustomModels(): Promise<DbCustomModel[]> {
  const result = await db.execute('SELECT * FROM custom_models ORDER BY created_at DESC');
  return result.rows as DbCustomModel[];
}

// 获取单个自定义模型
export async function getCustomModel(id: string): Promise<DbCustomModel | undefined> {
  const result = await db.execute({
    sql: 'SELECT * FROM custom_models WHERE id = ?',
    args: [id],
  });
  return result.rows[0] as DbCustomModel | undefined;
}

// 创建自定义模型
export async function createCustomModel(model: DbCustomModel): Promise<DbCustomModel> {
  await db.execute({
    sql: `INSERT INTO custom_models (id, model_id, name, description, provider, base_url, api_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [model.id, model.model_id, model.name, model.description, model.provider, model.base_url, model.api_key, model.created_at, model.updated_at],
  });
  return model;
}

// 更新自定义模型
export async function updateCustomModel(id: string, updates: Partial<Pick<DbCustomModel, 'model_id' | 'name' | 'description' | 'provider' | 'base_url' | 'api_key'>>): Promise<boolean> {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.model_id !== undefined) { fields.push('model_id = ?'); values.push(updates.model_id); }
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.provider !== undefined) { fields.push('provider = ?'); values.push(updates.provider); }
  if (updates.base_url !== undefined) { fields.push('base_url = ?'); values.push(updates.base_url); }
  if (updates.api_key !== undefined) { fields.push('api_key = ?'); values.push(updates.api_key); }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const result = await db.execute({
    sql: `UPDATE custom_models SET ${fields.join(', ')} WHERE id = ?`,
    args: values,
  });
  return result.rowsAffected > 0;
}

// 删除自定义模型
export async function deleteCustomModel(id: string): Promise<boolean> {
  const result = await db.execute({
    sql: 'DELETE FROM custom_models WHERE id = ?',
    args: [id],
  });
  return result.rowsAffected > 0;
}

// ============= Express 应用 =============

// 待处理的权限请求
interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  reject: (error: Error) => void;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

const pendingPermissions = new Map<string, PendingPermission>();

// 权限请求超时时间（5分钟）
const PERMISSION_TIMEOUT = 5 * 60 * 1000;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// 数据库初始化中间件
app.use(async (req, res, next) => {
  // 跳过健康检查等不需要数据库的路由
  if (req.path === '/api/health' || req.path === '/api/check-login' || req.path === '/api/models') {
    return next();
  }
  try {
    await ensureDatabaseInitialized();
    next();
  } catch (error) {
    console.error("[DB Middleware] Initialization failed:", error);
    res.status(500).json({ error: "数据库初始化失败" });
  }
});

// 缓存可用模型列表
let cachedModels: Array<{ modelId: string; name: string; description?: string }> = [];
const defaultModel = "claude-sonnet-4";

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 数据库统计信息
app.get("/api/db-stats", async (req, res) => {
  try {
    const stats = await getDbStats();
    res.json(stats);
  } catch (error: any) {
    console.error("[DB Stats] Error:", error);
    res.status(500).json({ error: error?.message || "获取数据库统计失败" });
  }
});

// 清空数据库
app.delete("/api/db/clear", async (req, res) => {
  try {
    await clearAllData();
    cachedModels = [];
    res.json({ success: true, message: "数据库已清空" });
  } catch (error: any) {
    console.error("[DB Clear] Error:", error);
    res.status(500).json({ error: error?.message || "清空数据库失败" });
  }
});

// 登录方式类型
type LoginMethod = 'env' | 'cli' | 'none';

interface LoginStatusResponse {
  isLoggedIn: boolean;
  method?: LoginMethod;
  envConfigured?: boolean;
  cliConfigured?: boolean;
  error?: string;
  apiKey?: string; // 脱敏后的 API Key
  envVars?: {
    apiKey?: string;
    authToken?: string;
    internetEnv?: string;
    baseUrl?: string;
  };
}

// 检查 CodeBuddy CLI 登录状态
app.get("/api/check-login", async (req, res) => {
  const response: LoginStatusResponse = {
    isLoggedIn: false,
    envConfigured: false,
    cliConfigured: false,
    envVars: {},
  };
  
  // 1. 检查环境变量
  const apiKey = process.env.CODEBUDDY_API_KEY;
  const authToken = process.env.CODEBUDDY_AUTH_TOKEN;
  const internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
  const baseUrl = process.env.CODEBUDDY_BASE_URL;
  
  if (apiKey || authToken) {
    response.envConfigured = true;
    // 脱敏显示
    if (apiKey) {
      response.envVars!.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4);
      response.apiKey = response.envVars!.apiKey;
    }
    if (authToken) {
      response.envVars!.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
    }
    if (internetEnv) {
      response.envVars!.internetEnv = internetEnv;
    }
    if (baseUrl) {
      response.envVars!.baseUrl = baseUrl;
    }
  }
  
  // 2. 使用 unstable_v2_authenticate 检查登录状态（更可靠）
  try {
    let needsLogin = false;
    
    const result = await unstable_v2_authenticate({
      environment: 'external',
      onAuthUrl: async (authState) => {
        // 如果执行到这个回调，说明未登录
        needsLogin = true;
        console.log('[Check Login] 需要登录，认证 URL:', authState.authUrl);
        // 将认证 URL 返回给前端（如果需要）
        response.error = '未登录，请先登录 CodeBuddy CLI';
      }
    });
    
    // 如果没有触发 onAuthUrl 回调，说明已登录
    if (!needsLogin && result?.userinfo) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      
      // 判断登录方式
      if (response.envConfigured) {
        response.method = 'env';
      } else {
        response.method = 'cli';
      }
      
      console.log('[Check Login] 已登录用户:', result.userinfo.userName);
    } else if (!needsLogin) {
      // result 存在但没有 userinfo，仍然认为已登录
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    }
  } catch (error: any) {
    console.error("[Check Login] SDK Error:", error);
    
    // 如果有环境变量配置，仍然认为是登录状态
    if (response.envConfigured) {
      response.isLoggedIn = true;
      response.method = 'env';
    } else {
      response.error = error?.message || String(error);
      response.method = 'none';
    }
  }
  
  res.json(response);
});

// 保存环境变量配置
app.post("/api/save-env-config", (req, res) => {
  const { apiKey, authToken, internetEnv, baseUrl } = req.body;
  
  if (!apiKey && !authToken) {
    return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });
  }
  
  const configuredVars: string[] = [];
  
  // 设置环境变量（仅在当前进程有效）
  if (apiKey) {
    process.env.CODEBUDDY_API_KEY = apiKey;
    configuredVars.push('CODEBUDDY_API_KEY');
  }
  if (authToken) {
    process.env.CODEBUDDY_AUTH_TOKEN = authToken;
    configuredVars.push('CODEBUDDY_AUTH_TOKEN');
  }
  if (internetEnv) {
    process.env.CODEBUDDY_INTERNET_ENVIRONMENT = internetEnv;
    configuredVars.push('CODEBUDDY_INTERNET_ENVIRONMENT');
  }
  if (baseUrl) {
    process.env.CODEBUDDY_BASE_URL = baseUrl;
    configuredVars.push('CODEBUDDY_BASE_URL');
  }
  
  // 清除模型缓存，以便重新获取
  cachedModels = [];
  
  res.json({ 
    success: true, 
    message: `已设置: ${configuredVars.join(', ')}`,
    note: '环境变量仅在当前服务器进程有效，重启后需要重新设置'
  });
});

// 获取可用模型列表
app.get("/api/models", async (req, res) => {
  try {
    if (cachedModels.length === 0) {
      console.log("[Models] Creating session to fetch available models...");
      
      const session = await unstable_v2_createSession({ 
        cwd: process.cwd()
      });
      
      console.log("[Models] Session created, calling getAvailableModels()...");
      const models = await session.getAvailableModels();
      console.log("[Models] Got", models.length, "models");
      
      if (models && Array.isArray(models)) {
        cachedModels = models;
      }
    }
    
    res.json({ 
      models: cachedModels.length > 0 ? cachedModels : [
        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }
      ],
      defaultModel 
    });
  } catch (error: any) {
    console.error("[Models] Error:", error);
    res.json({
      models: [
        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" },
        { modelId: "claude-opus-4", name: "Claude Opus 4" }
      ],
      defaultModel,
      error: error?.message || String(error)
    });
  }
});

// ============= 自定义模型 API =============

// 获取所有自定义模型
app.get("/api/custom-models", async (req, res) => {
  try {
    const models = await getAllCustomModels();
    // 脱敏 API Key
    const sanitized = models.map(m => ({
      ...m,
      api_key: m.api_key.slice(0, 6) + '****' + m.api_key.slice(-4),
    }));
    res.json({ models: sanitized });
  } catch (error: any) {
    console.error("[Custom Models] Error:", error);
    res.status(500).json({ error: error?.message || "获取自定义模型失败" });
  }
});

// 创建自定义模型
app.post("/api/custom-models", async (req, res) => {
  try {
    const { modelId, name, description, provider, baseUrl, apiKey } = req.body;

    if (!modelId || !name || !provider || !baseUrl || !apiKey) {
      return res.status(400).json({ error: "缺少必填字段（modelId, name, provider, baseUrl, apiKey）" });
    }

    const now = new Date().toISOString();
    const model = await createCustomModel({
      id: uuidv4(),
      model_id: modelId,
      name,
      description: description || null,
      provider,
      base_url: baseUrl,
      api_key: apiKey,
      created_at: now,
      updated_at: now,
    });

    res.json({
      model: {
        ...model,
        api_key: model.api_key.slice(0, 6) + '****' + model.api_key.slice(-4),
      }
    });
  } catch (error: any) {
    console.error("[Custom Models] Create Error:", error);
    if (error?.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: "模型 ID 已存在" });
    }
    res.status(500).json({ error: error?.message || "创建自定义模型失败" });
  }
});

// 更新自定义模型
app.patch("/api/custom-models/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { modelId, name, description, provider, baseUrl, apiKey } = req.body;

    const success = await updateCustomModel(id, {
      ...(modelId !== undefined && { model_id: modelId }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(provider !== undefined && { provider }),
      ...(baseUrl !== undefined && { base_url: baseUrl }),
      ...(apiKey && { api_key: apiKey }),  // 仅在 apiKey 非空时更新
    });

    if (!success) {
      return res.status(404).json({ error: "自定义模型不存在" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Custom Models] Update Error:", error);
    res.status(500).json({ error: error?.message || "更新自定义模型失败" });
  }
});

// 删除自定义模型
app.delete("/api/custom-models/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await deleteCustomModel(id);

    if (!success) {
      return res.status(404).json({ error: "自定义模型不存在" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Custom Models] Delete Error:", error);
    res.status(500).json({ error: error?.message || "删除自定义模型失败" });
  }
});

// ============= 会话 API =============

// 获取所有会话（包含消息数量）
app.get("/api/sessions", async (req, res) => {
  try {
    const sessions = await getAllSessions();
    const sessionsWithMessages = await Promise.all(sessions.map(async session => {
      const messages = await getMessagesBySession(session.id);
      return {
        ...session,
        messageCount: messages.length
      };
    }));
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    console.error("[Sessions] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    const messages = await getMessagesBySession(sessionId);
    
    // 解析 tool_calls JSON
    const parsedMessages = messages.map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));
    
    res.json({ session, messages: parsedMessages });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 创建新会话
app.post("/api/sessions", async (req, res) => {
  try {
    const { model = defaultModel, title = "新对话" } = req.body;
    const now = new Date().toISOString();
    
    const session = await createSession({
      id: uuidv4(),
      title,
      model,
      sdk_session_id: null,
      created_at: now,
      updated_at: now
    });
    
    res.json({ session });
  } catch (error: any) {
    console.error("[Create Session] Error:", error);
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

// 更新会话
app.patch("/api/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model } = req.body;
    
    const success = await updateSession(sessionId, { title, model });
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Update Session] Error:", error);
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

// 删除会话
app.delete("/api/sessions/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = await deleteSession(sessionId);
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Session] Error:", error);
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= 聊天 API =============

// 权限响应 API
app.post("/api/permission-response", (req, res) => {
  const { requestId, behavior, message } = req.body;
  
  console.log(`[Permission] Response received: requestId=${requestId}, behavior=${behavior}`);
  
  const pending = pendingPermissions.get(requestId);
  if (!pending) {
    console.log(`[Permission] Request not found: ${requestId}`);
    return res.status(404).json({ error: "权限请求不存在或已超时" });
  }
  
  // 清除请求
  pendingPermissions.delete(requestId);
  
  if (behavior === 'allow') {
    pending.resolve({
      behavior: 'allow',
      updatedInput: pending.input
    });
  } else {
    pending.resolve({
      behavior: 'deny',
      message: message || '用户拒绝了此操作'
    });
  }
  
  res.json({ success: true });
});

// 发送消息并获取流式响应
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model, systemPrompt, cwd, permissionMode } = req.body;
  
  // 请求日志
  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}`);
  console.log(`[Chat] Model: ${model}`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? '...' : ''}`);
  console.log(`[Chat] CWD: ${cwd || 'default'}`);

  if (!message) {
    console.log(`[Chat] 错误: 消息为空`);
    return res.status(400).json({ error: "消息不能为空" });
  }

  // 获取或创建会话
  let session = sessionId ? await getSession(sessionId) : null;
  const now = new Date().toISOString();
  
  if (!session) {
    // 创建新会话
    console.log(`[Chat] 创建新会话`);
    session = await createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: model || defaultModel,
      sdk_session_id: null,
      created_at: now,
      updated_at: now
    });
  } else {
    console.log(`[Chat] 使用现有会话, SDK Session: ${session.sdk_session_id || 'none'}`);
  }

  const selectedModel = model || session.model;
  
  // 创建用户消息 ID 和助手消息 ID
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息到数据库
  try {
    await createMessage({
      id: userMessageId,
      session_id: session.id,
      role: 'user',
      content: message,
      model: null,
      created_at: now,
      tool_calls: null
    });
    console.log(`[Chat] 用户消息已保存: ${userMessageId}`);
  } catch (dbError: any) {
    console.error(`[Chat] 保存用户消息失败:`, dbError);
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 默认系统提示词
  const defaultSystemPrompt = "你是「医美数据决策助手」，一名深耕医疗美容行业的运营数据分析与决策支持专家。整合医美机构分散在 HIS/CRM、企微、美团/大众点评、抖音、有赞及 Excel 台账中的多源数据，做经营与运营分析（营收毛利、客单价、到店率、升单率、复购率、渠道 CAC/ROI、转化漏斗等），并输出结构化、可落地的决策建议（核心结论→关键指标→数据洞察→行动建议→风险提示）。不编造数据，结论注明来源与口径；医美宣称需合规。能用工具（读取文件、Python/pandas、生成图表报告）就使用。";

  // ============= 检查是否为自定义模型 =============
  const customModels = await getAllCustomModels();
  const customModel = customModels.find(m => m.model_id === selectedModel);

  if (customModel) {
    // 自定义模型：直接调用 OpenAI 兼容 API
    console.log(`[Chat] 使用自定义模型: ${customModel.name} (${customModel.model_id})`);
    console.log(`[Chat] Base URL: ${customModel.base_url}`);

    let fullResponse = "";

    // 发送 init 事件
    res.write(`data: ${JSON.stringify({ 
      type: "init", 
      sessionId: session.id, 
      userMessageId, 
      assistantMessageId,
      model: selectedModel 
    })}\n\n`);

    try {
      // 获取历史消息构建对话上下文
      const historyMessages = await getMessagesBySession(session.id);
      const chatMessages: Array<{ role: string; content: string }> = [];

      // 添加系统提示词
      chatMessages.push({ role: "system", content: systemPrompt || defaultSystemPrompt });

      // 添加历史消息
      for (const msg of historyMessages) {
        chatMessages.push({ role: msg.role, content: msg.content });
      }

      // 调用 OpenAI 兼容 API（流式）
      const apiUrl = `${customModel.base_url.replace(/\/$/, '')}/chat/completions`;
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customModel.api_key}`,
        },
        body: JSON.stringify({
          model: customModel.model_id,
          messages: chatMessages,
          stream: true,
        }),
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error(`[Chat] API 错误: ${apiResponse.status} ${errorText}`);
        res.write(`data: ${JSON.stringify({ type: "error", message: `API 错误 (${apiResponse.status}): ${errorText.slice(0, 200)}` })}\n\n`);
        res.end();
        return;
      }

      // 处理 SSE 流式响应
      const reader = apiResponse.body?.getReader();
      if (!reader) {
        res.write(`data: ${JSON.stringify({ type: "error", message: "无法读取 API 响应流" })}\n\n`);
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              fullResponse += delta.content;
              res.write(`data: ${JSON.stringify({ type: "text", content: delta.content })}\n\n`);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 发送完成事件
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);

      // 保存助手消息
      await createMessage({
        id: assistantMessageId,
        session_id: session.id,
        role: 'assistant',
        content: fullResponse,
        model: selectedModel,
        created_at: new Date().toISOString(),
        tool_calls: null
      });

      // 更新会话标题
      const msgs = await getMessagesBySession(session.id);
      if (msgs.length <= 2) {
        await updateSession(session.id, { 
          title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
          model: selectedModel
        });
      }

      console.log(`[Chat] 自定义模型请求完成 ✓`);
      res.end();
    } catch (error: any) {
      console.error(`[Chat] 自定义模型错误:`, error);
      res.write(`data: ${JSON.stringify({ type: "error", message: error?.message || "请求自定义模型失败" })}\n\n`);
      res.end();
    }
    return;
  }

  // ============= CodeBuddy SDK 模型（原有逻辑） =============
  const sdkSessionId = session.sdk_session_id;
  const workingDir = cwd || process.cwd();

  try {
    console.log(`[Chat] 调用 SDK query...`);
    console.log(`[Chat] - Model: ${selectedModel}`);
    console.log(`[Chat] - Resume: ${sdkSessionId || 'none'}`);
    console.log(`[Chat] - CWD: ${workingDir}`);
    console.log(`[Chat] - PermissionMode: ${permissionMode || 'default'}`);
    
    // 创建 canUseTool 回调
    const canUseTool: CanUseTool = async (toolName, input, options) => {
      console.log(`[Permission] Tool request: ${toolName}`);
      console.log(`[Permission] Input:`, JSON.stringify(input, null, 2));
      
      // bypassPermissions 模式直接放行
      if (permissionMode === 'bypassPermissions') {
        console.log(`[Permission] Bypassing permissions for ${toolName}`);
        return { behavior: 'allow', updatedInput: input };
      }
      
      // 创建权限请求
      const requestId = uuidv4();
      const permissionRequest = {
        requestId,
        toolUseId: options.toolUseID,
        toolName,
        input,
        sessionId: session.id,
        timestamp: Date.now()
      };
      
      // 发送权限请求到前端
      res.write(`data: ${JSON.stringify({ 
        type: "permission_request", 
        ...permissionRequest
      })}\n\n`);
      
      // 创建 Promise 等待用户响应
      return new Promise<PermissionResult>((resolve, reject) => {
        const pending: PendingPermission = {
          resolve,
          reject,
          toolName,
          input,
          sessionId: session.id,
          timestamp: Date.now()
        };
        
        pendingPermissions.set(requestId, pending);
        
        // 设置超时
        setTimeout(() => {
          if (pendingPermissions.has(requestId)) {
            pendingPermissions.delete(requestId);
            console.log(`[Permission] Request timeout: ${requestId}`);
            resolve({
              behavior: 'deny',
              message: '权限请求超时'
            });
          }
        }, PERMISSION_TIMEOUT);
      });
    };
    
    // 使用 Query API 发送消息
    // 如果有 sdk_session_id，使用 resume 恢复对话上下文
    const stream = query({
      prompt: message,
      options: {
        cwd: workingDir,
        model: selectedModel,
        maxTurns: 10,
        systemPrompt: systemPrompt || defaultSystemPrompt,
        permissionMode: permissionMode || 'default',
        canUseTool,
        ...(sdkSessionId ? { resume: sdkSessionId } : {})  // 使用 resume 恢复对话
      }
    });

    let fullResponse = "";
    let toolCalls: Array<{ 
      id: string; 
      name: string; 
      input?: Record<string, unknown>;
      status: string; 
      result?: string;
      isError?: boolean;
    }> = [];
    let newSdkSessionId: string | null = null;  // 用于存储 SDK 返回的 session_id

    // 发送会话ID和消息ID
    res.write(`data: ${JSON.stringify({ 
      type: "init", 
      sessionId: session.id, 
      userMessageId, 
      assistantMessageId,
      model: selectedModel 
    })}\n\n`);

    // 当前正在执行的工具 ID（用于匹配 tool_result）
    let currentToolId: string | null = null;

    // 处理流式响应
    for await (const msg of stream) {
      console.log("[Stream] Message type:", msg.type, msg);
      
      // 处理 system 消息，获取 SDK 的 session_id
      if (msg.type === "system" && (msg as any).subtype === "init") {
        newSdkSessionId = (msg as any).session_id;
        console.log(`[Stream] Got SDK session_id: ${newSdkSessionId}`);
        
        // 保存 SDK session_id 到数据库（如果是新的）
        if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
          await updateSession(session.id, { sdk_session_id: newSdkSessionId });
          console.log(`[Stream] Saved SDK session_id to database`);
        }
      } else if (msg.type === "assistant") {
        const content = msg.message.content;

        if (typeof content === "string") {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              fullResponse += block.text;
              res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
            } else if (block.type === "tool_use") {
              currentToolId = block.id || uuidv4();
              const toolInput = (block as any).input || {};
              console.log(`[Stream] Tool use: id=${currentToolId}, name=${block.name}`);
              console.log(`[Stream] Tool input:`, JSON.stringify(toolInput, null, 2));
              
              const toolCall = { 
                id: currentToolId, 
                name: block.name, 
                input: toolInput,
                status: "running" 
              };
              toolCalls.push(toolCall);
              res.write(`data: ${JSON.stringify({ 
                type: "tool", 
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.input,
                status: toolCall.status
              })}\n\n`);
            }
          }
        }
      } else if ((msg as any).type === "tool_result") {
        // 处理工具结果（独立的消息类型）
        const msgAny = msg as any;
        const toolId = msgAny.tool_use_id || currentToolId;
        const isError = msgAny.is_error || false;
        const content = msgAny.content;
        
        console.log(`[Stream] Tool result: tool_use_id=${toolId}, is_error=${isError}`);
        console.log(`[Stream] Tool result content type:`, typeof content);
        console.log(`[Stream] Tool result content:`, typeof content === 'string' ? content.slice(0, 500) : JSON.stringify(content, null, 2)?.slice(0, 500));
        
        const tool = toolCalls.find(t => t.id === toolId) || toolCalls[toolCalls.length - 1];
        if (tool) {
          tool.status = isError ? "error" : "completed";
          tool.isError = isError;
          tool.result = typeof content === 'string' 
            ? content 
            : JSON.stringify(content);
          res.write(`data: ${JSON.stringify({ 
            type: "tool_result", 
            toolId: tool.id, 
            content: tool.result,
            isError: isError
          })}\n\n`);
        }
        currentToolId = null;
      } else if (msg.type === "result") {
        // 完成时确保所有工具都标记为完成
        toolCalls.forEach(tool => {
          if (tool.status === "running") {
            tool.status = "completed";
            res.write(`data: ${JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" })}\n\n`);
          }
        });
        res.write(`data: ${JSON.stringify({ type: "done", duration: msg.duration_ms, cost: msg.total_cost_usd })}\n\n`);
      }
    }

    // 保存助手消息到数据库
    await createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: fullResponse,
      model: selectedModel,
      created_at: new Date().toISOString(),
      tool_calls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
    });

    // 更新会话标题（如果是第一条消息）
    const messages = await getMessagesBySession(session.id);
    if (messages.length <= 2) {
      await updateSession(session.id, { 
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        model: selectedModel
      });
    }

    console.log(`[Chat] 请求完成 ✓`);
    res.end();
  } catch (error: any) {
    console.error(`\n[Chat] ========== 错误 ==========`);
    console.error(`[Chat] Error Name:`, error?.name);
    console.error(`[Chat] Error Message:`, error?.message);
    console.error(`[Chat] Error Code:`, error?.code);
    console.error(`[Chat] Error Stack:`, error?.stack);
    console.error(`[Chat] Full Error:`, JSON.stringify(error, null, 2));
    
    const errorMessage = error?.message || "处理请求时发生错误";
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`);
    res.end();
  }
});

// 启动服务器（仅在本地直接运行时）
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     ◉ API 服务器已启动                      ║
║                                            ║
║     地址: http://localhost:${PORT}            ║
║     数据库: Turso (libsql)                 ║
║                                            ║
╚════════════════════════════════════════════╝
    `);
  });
}

export default app;
