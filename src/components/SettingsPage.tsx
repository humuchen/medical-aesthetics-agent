import { useState, useEffect, useCallback } from 'react';
import { 
  Form, 
  Input, 
  Textarea, 
  Button, 
  Tooltip,
  Popconfirm,
  MessagePlugin,
  Loading,
  Link,
  Tag,
  Select,
  Dialog
} from 'tdesign-react';
import { 
  AddIcon, 
  EditIcon, 
  DeleteIcon,
  CheckIcon,
  CheckCircleFilledIcon,
  CloseCircleFilledIcon,
  RefreshIcon,
  FolderOpenIcon
} from 'tdesign-icons-react';
import { Bot, Sparkles, Code, FileText, Globe, Lightbulb } from 'lucide-react';
import { CustomAgent, CustomModel, PermissionMode } from '../types';

interface SettingsPageProps {
  agents: CustomAgent[];
  customModels: CustomModel[];
  onAdd: (agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => CustomAgent;
  onUpdate: (id: string, updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
  onAddCustomModel: (model: Omit<CustomModel, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateCustomModel: (id: string, updates: Partial<Omit<CustomModel, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  onDeleteCustomModel: (id: string) => void;
}

type LoginMethod = 'env' | 'cli' | 'none';

interface LoginStatus {
  isLoggedIn: boolean;
  checking: boolean;
  method?: LoginMethod;
  envConfigured?: boolean;
  cliConfigured?: boolean;
  error?: string;
  apiKey?: string;
  envVars?: {
    apiKey?: string;
    authToken?: string;
    internetEnv?: string;
    baseUrl?: string;
  };
}

const PRESET_ICONS = [
  { name: 'Bot', icon: Bot },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Code', icon: Code },
  { name: 'FileText', icon: FileText },
  { name: 'Globe', icon: Globe },
  { name: 'Lightbulb', icon: Lightbulb },
];

const PRESET_COLORS = [
  '#0052d9', '#0594fa', '#00a870', '#ed7b2f', 
  '#e34d59', '#a25eb5', '#5c6bc0', '#26a69a'
];

const MODEL_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { value: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { value: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { value: 'siliconflow', label: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1' },
  { value: 'zhipu', label: '智谱 (GLM)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { value: 'moonshot', label: 'Moonshot (Kimi)', baseUrl: 'https://api.moonshot.cn/v1' },
  { value: 'custom', label: '自定义', baseUrl: '' },
];

const PERMISSION_MODES: { value: PermissionMode; label: string; description: string }[] = [
  { value: 'default', label: 'default', description: '默认模式，所有操作需确认' },
  { value: 'acceptEdits', label: 'acceptEdits', description: '自动批准文件编辑，Bash 仍需确认' },
  { value: 'plan', label: 'plan', description: '规划模式，仅允许读取操作' },
  { value: 'bypassPermissions', label: 'bypassPermissions', description: '跳过所有权限检查（谨慎使用）' },
];

const PRESET_TEMPLATES = [
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

export function SettingsPage({ 
  agents, 
  customModels,
  onAdd, 
  onUpdate, 
  onDelete,
  onAddCustomModel,
  onUpdateCustomModel,
  onDeleteCustomModel,
}: SettingsPageProps) {
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    icon: 'Bot',
    color: '#0052d9',
    permissionMode: 'default' as PermissionMode,
  });
  
  // 登录状态
  const [loginStatus, setLoginStatus] = useState<LoginStatus>({
    isLoggedIn: false,
    checking: true,
  });
  
  // 环境变量配置
  const [showEnvConfig, setShowEnvConfig] = useState(false);
  const [envConfig, setEnvConfig] = useState({
    apiKey: '',
    authToken: '',
    internetEnv: '' as '' | 'internal' | 'iOA',
    baseUrl: '',
  });
  const [savingEnv, setSavingEnv] = useState(false);

  // 自定义模型
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [editingModel, setEditingModel] = useState<CustomModel | null>(null);
  const [modelFormData, setModelFormData] = useState({
    modelId: '',
    name: '',
    description: '',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
  });

  // 数据库管理
  const [dbStats, setDbStats] = useState<{
    sessions: number;
    messages: number;
    customModels: number;
    dbSizeKB: number;
    tables: string[];
  } | null>(null);
  const [dbStatsLoading, setDbStatsLoading] = useState(false);

  // 默认对话配置
  const [defaultAgentId, setDefaultAgentId] = useState(() => 
    localStorage.getItem('defaultAgentId') || 'default'
  );
  const [defaultCwd, setDefaultCwd] = useState(() => 
    localStorage.getItem('defaultCwd') || ''
  );

  // 检查登录状态
  const checkLoginStatus = useCallback(async () => {
    setLoginStatus(prev => ({ ...prev, checking: true, error: undefined }));
    
    try {
      const response = await fetch('/api/check-login');
      const data = await response.json();
      
      setLoginStatus({
        isLoggedIn: data.isLoggedIn,
        checking: false,
        method: data.method,
        envConfigured: data.envConfigured,
        cliConfigured: data.cliConfigured,
        error: data.error,
        apiKey: data.apiKey,
        envVars: data.envVars,
      });
    } catch (error: any) {
      setLoginStatus({
        isLoggedIn: false,
        checking: false,
        error: error?.message || '检查登录状态失败',
      });
    }
  }, []);
  
  // 保存环境变量配置
  const saveEnvConfig = async () => {
    // 至少需要配置一个有效的值
    const hasAnyConfig = envConfig.apiKey.trim() || envConfig.authToken.trim();
    if (!hasAnyConfig) {
      MessagePlugin.warning('请至少配置 API Key 或 Auth Token');
      return;
    }
    
    setSavingEnv(true);
    try {
      const response = await fetch('/api/save-env-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: envConfig.apiKey.trim() || undefined,
          authToken: envConfig.authToken.trim() || undefined,
          internetEnv: envConfig.internetEnv || undefined,
          baseUrl: envConfig.baseUrl.trim() || undefined,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        MessagePlugin.success(data.message);
        setShowEnvConfig(false);
        setEnvConfig({ apiKey: '', authToken: '', internetEnv: '', baseUrl: '' });
        // 重新检查登录状态
        checkLoginStatus();
      } else {
        MessagePlugin.error(data.error || '保存失败');
      }
    } catch (error: any) {
      MessagePlugin.error(error?.message || '保存失败');
    } finally {
      setSavingEnv(false);
    }
  };

  // 初始化时检查登录状态
  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
      icon: 'Bot',
      color: '#0052d9',
      permissionMode: 'default',
    });
    setEditingAgent(null);
    setIsCreating(false);
  };

  const resetModelForm = () => {
    setModelFormData({
      modelId: '',
      name: '',
      description: '',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
    });
    setEditingModel(null);
    setIsCreatingModel(false);
  };

  const handleProviderChange = (provider: string) => {
    const preset = MODEL_PROVIDERS.find(p => p.value === provider);
    setModelFormData(prev => ({
      ...prev,
      provider,
      baseUrl: preset?.baseUrl || prev.baseUrl,
    }));
  };

  const handleEditModel = (model: CustomModel) => {
    setEditingModel(model);
    setModelFormData({
      modelId: model.modelId,
      name: model.name,
      description: model.description || '',
      provider: model.provider,
      baseUrl: model.baseUrl,
      apiKey: '',  // 不回显脱敏的 key，留空表示不修改
    });
    setIsCreatingModel(true);
  };

  const handleSaveModel = () => {
    if (!modelFormData.modelId.trim() || !modelFormData.name.trim() || !modelFormData.baseUrl.trim()) {
      MessagePlugin.warning('请填写模型 ID、名称和 Base URL');
      return;
    }
    if (!editingModel && !modelFormData.apiKey.trim()) {
      MessagePlugin.warning('新增模型请填写 API Key');
      return;
    }

    if (editingModel) {
      onUpdateCustomModel(editingModel.id, modelFormData);
      MessagePlugin.success('自定义模型已更新');
    } else {
      onAddCustomModel(modelFormData);
      MessagePlugin.success('自定义模型已添加');
    }
    resetModelForm();
  };

  const handleDeleteModel = (id: string) => {
    onDeleteCustomModel(id);
    MessagePlugin.success('自定义模型已删除');
  };

  // 数据库管理
  const fetchDbStats = useCallback(async () => {
    setDbStatsLoading(true);
    try {
      const res = await fetch('/api/db-stats');
      const data = await res.json();
      setDbStats(data);
    } catch (error) {
      console.error('Failed to fetch db stats:', error);
    } finally {
      setDbStatsLoading(false);
    }
  }, []);

  const handleClearDb = useCallback(async () => {
    try {
      const res = await fetch('/api/db/clear', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        MessagePlugin.success('数据库已清空');
        fetchDbStats();
      } else {
        MessagePlugin.error(data.error || '清空失败');
      }
    } catch (error: any) {
      MessagePlugin.error(error?.message || '清空数据库失败');
    }
  }, [fetchDbStats]);

  // 保存默认对话配置
  const handleSaveDefaultConfig = () => {
    localStorage.setItem('defaultAgentId', defaultAgentId);
    localStorage.setItem('defaultCwd', defaultCwd);
    MessagePlugin.success('默认对话配置已保存');
  };

  const handleEdit = (agent: CustomAgent) => {
    if (agent.id === 'default') return;
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || '',
      systemPrompt: agent.systemPrompt,
      icon: agent.icon || 'Bot',
      color: agent.color || '#0052d9',
      permissionMode: agent.permissionMode || 'default',
    });
    setIsCreating(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) {
      MessagePlugin.warning('请填写名称和系统提示词');
      return;
    }

    if (editingAgent) {
      onUpdate(editingAgent.id, formData);
      MessagePlugin.success('Agent 已更新');
    } else {
      onAdd(formData);
      MessagePlugin.success('Agent 已创建');
    }
    resetForm();
  };

  const handleUseTemplate = (template: typeof PRESET_TEMPLATES[0]) => {
    setFormData({
      ...template,
      description: template.description,
      permissionMode: 'default' as PermissionMode,
    });
    setIsCreating(true);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    MessagePlugin.success('Agent 已删除');
  };

  const getIconComponent = (iconName: string) => {
    const preset = PRESET_ICONS.find(p => p.name === iconName);
    return preset ? preset.icon : Bot;
  };

  const customAgents = agents.filter(a => a.id !== 'default');

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* 页面标题 */}
        <div>
          <h1 
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            设置
          </h1>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            管理应用配置、自定义模型和 Agent
          </p>
        </div>

        {/* 默认对话配置 */}
        <div>
          <div className="mb-4">
            <h2 
              className="text-lg font-medium"
              style={{ color: 'var(--td-text-color-primary)' }}
            >
              默认对话配置
            </h2>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--td-text-color-secondary)' }}
            >
              新建对话时默认使用的 Agent 和工作目录
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label 
                className="text-sm font-medium block mb-2"
                style={{ color: 'var(--td-text-color-primary)' }}
              >
                默认 Agent
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {agents.map(agent => {
                  const AgentIcon = getIconComponent(agent.icon || 'Bot');
                  const isSelected = agent.id === defaultAgentId;
                  return (
                    <div
                      key={agent.id}
                      className="p-2.5 rounded-lg cursor-pointer transition-all border-2"
                      style={{
                        borderColor: isSelected ? (agent.color || 'var(--td-brand-color)') : 'transparent',
                        backgroundColor: isSelected ? 'var(--td-brand-color-light)' : 'var(--td-bg-color-component)',
                      }}
                      onClick={() => setDefaultAgentId(agent.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: agent.color || '#0052d9' }}
                        >
                          <AgentIcon size={14} color="white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: 'var(--td-text-color-primary)' }}>
                            {agent.name}
                          </div>
                          {agent.description && (
                            <div className="text-xs truncate" style={{ color: 'var(--td-text-color-placeholder)' }}>
                              {agent.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label 
                className="text-sm font-medium block mb-2"
                style={{ color: 'var(--td-text-color-primary)' }}
              >
                默认工作目录 <span style={{ color: 'var(--td-text-color-placeholder)' }}>(可选)</span>
              </label>
              <Input
                value={defaultCwd}
                onChange={(v) => setDefaultCwd(v as string)}
                placeholder="例如：/Users/username/projects/my-app"
                prefixIcon={<FolderOpenIcon />}
              />
              <p className="text-xs mt-1.5" style={{ color: 'var(--td-text-color-placeholder)' }}>
                指定 Agent 的工作目录，用于文件操作等
              </p>
            </div>

            <div className="flex justify-end">
              <Button theme="primary" onClick={handleSaveDefaultConfig}>
                保存配置
              </Button>
            </div>
          </div>
        </div>

        {/* 登录配置 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 
                className="text-lg font-medium"
                style={{ color: 'var(--td-text-color-primary)' }}
              >
                登录配置
              </h2>
              <p 
                className="text-sm mt-1"
                style={{ color: 'var(--td-text-color-secondary)' }}
              >
                支持环境变量或 CodeBuddy CLI 登录
              </p>
            </div>
            <Button 
              variant="text" 
              icon={<RefreshIcon />}
              onClick={checkLoginStatus}
              loading={loginStatus.checking}
            >
              刷新
            </Button>
          </div>
          
          {/* 当前状态 */}
          <div className="flex items-center gap-3 mb-6">
            {loginStatus.checking ? (
              <>
                <Loading size="small" />
                <span style={{ color: 'var(--td-text-color-secondary)' }}>
                  正在检查登录状态...
                </span>
              </>
            ) : loginStatus.isLoggedIn ? (
              <>
                <CheckCircleFilledIcon 
                  size="20px" 
                  style={{ color: 'var(--td-success-color)' }} 
                />
                <span style={{ color: 'var(--td-text-color-primary)' }}>
                  已登录
                </span>
                <Tag size="small" variant="outline">
                  {loginStatus.method === 'env' ? '环境变量' : 'CLI'}
                </Tag>
                {loginStatus.method === 'env' && loginStatus.apiKey && (
                  <span 
                    className="text-sm font-mono"
                    style={{ color: 'var(--td-text-color-secondary)' }}
                  >
                    {loginStatus.apiKey}
                  </span>
                )}
              </>
            ) : (
              <>
                <CloseCircleFilledIcon 
                  size="20px" 
                  style={{ color: 'var(--td-text-color-placeholder)' }} 
                />
                <span style={{ color: 'var(--td-text-color-secondary)' }}>
                  未登录
                </span>
              </>
            )}
          </div>
          
          {/* 环境变量配置 */}
          <div className="mb-6">
            <h3 
              className="text-sm font-medium mb-3"
              style={{ color: 'var(--td-text-color-secondary)' }}
            >
              方式一：环境变量
            </h3>
            
            {showEnvConfig ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label 
                      className="text-xs block mb-1"
                      style={{ color: 'var(--td-text-color-placeholder)' }}
                    >
                      CODEBUDDY_API_KEY
                    </label>
                    <Input
                      type="password"
                      size="small"
                      value={envConfig.apiKey}
                      onChange={(v) => setEnvConfig(prev => ({ ...prev, apiKey: v as string }))}
                      placeholder="API 密钥（推荐）"
                    />
                  </div>
                  <div>
                    <label 
                      className="text-xs block mb-1"
                      style={{ color: 'var(--td-text-color-placeholder)' }}
                    >
                      CODEBUDDY_AUTH_TOKEN
                    </label>
                    <Input
                      type="password"
                      size="small"
                      value={envConfig.authToken}
                      onChange={(v) => setEnvConfig(prev => ({ ...prev, authToken: v as string }))}
                      placeholder="认证令牌"
                    />
                  </div>
                  <div>
                    <label 
                      className="text-xs block mb-1"
                      style={{ color: 'var(--td-text-color-placeholder)' }}
                    >
                      CODEBUDDY_INTERNET_ENVIRONMENT
                    </label>
                    <Select
                      size="small"
                      value={envConfig.internetEnv}
                      onChange={(v) => setEnvConfig(prev => ({ ...prev, internetEnv: v as any }))}
                      placeholder="网络环境（可选）"
                      clearable
                      options={[
                        { label: 'internal', value: 'internal' },
                        { label: 'iOA', value: 'iOA' },
                      ]}
                    />
                  </div>
                  <div>
                    <label 
                      className="text-xs block mb-1"
                      style={{ color: 'var(--td-text-color-placeholder)' }}
                    >
                      CODEBUDDY_BASE_URL
                    </label>
                    <Input
                      size="small"
                      value={envConfig.baseUrl}
                      onChange={(v) => setEnvConfig(prev => ({ ...prev, baseUrl: v as string }))}
                      placeholder="自定义 URL（可选）"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="small"
                    theme="primary" 
                    onClick={saveEnvConfig}
                    loading={savingEnv}
                  >
                    保存
                  </Button>
                  <Button 
                    size="small"
                    variant="text" 
                    onClick={() => {
                      setShowEnvConfig(false);
                      setEnvConfig({ apiKey: '', authToken: '', internetEnv: '', baseUrl: '' });
                    }}
                  >
                    取消
                  </Button>
                  <span 
                    className="text-xs"
                    style={{ color: 'var(--td-text-color-placeholder)' }}
                  >
                    仅当前进程有效
                  </span>
                </div>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="small"
                onClick={() => setShowEnvConfig(true)}
              >
                配置环境变量
              </Button>
            )}
          </div>
          
          {/* CLI 登录 */}
          <div>
            <h3 
              className="text-sm font-medium mb-3"
              style={{ color: 'var(--td-text-color-secondary)' }}
            >
              方式二：CodeBuddy CLI
            </h3>
            <div className="flex items-center gap-3">
              <code 
                className="px-3 py-1.5 rounded text-sm"
                style={{ 
                  backgroundColor: 'var(--td-bg-color-component)',
                  color: 'var(--td-text-color-primary)'
                }}
              >
                codebuddy
              </code>
              <Link 
                href="https://www.codebuddy.ai/docs/zh/cli/settings" 
                target="_blank"
                theme="primary"
                size="small"
              >
                查看文档
              </Link>
            </div>
          </div>
          
          {loginStatus.error && !loginStatus.isLoggedIn && (
            <div 
              className="text-xs mt-4"
              style={{ color: 'var(--td-text-color-placeholder)' }}
            >
              {loginStatus.error}
            </div>
          )}
        </div>

        <div 
          style={{ 
            height: '1px', 
            backgroundColor: 'var(--td-component-border)' 
          }} 
        />

        {/* 自定义模型配置 */}
        <div>
          <div className="mb-4">
            <h2 
              className="text-lg font-medium"
              style={{ color: 'var(--td-text-color-primary)' }}
            >
              自定义模型
            </h2>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--td-text-color-secondary)' }}
            >
              添加 OpenAI 兼容 API 的自定义模型
            </p>
          </div>

          <div className="space-y-6">
            {/* 创建/编辑表单 */}
            {isCreatingModel ? (
              <div 
                className="p-5 rounded-xl border"
                style={{ 
                  backgroundColor: 'var(--td-bg-color-container)',
                  borderColor: 'var(--td-component-border)'
                }}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-base font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                      {editingModel ? '编辑自定义模型' : '添加自定义模型'}
                    </h4>
                    <Button variant="text" onClick={resetModelForm}>取消</Button>
                  </div>
                  
                  <Form labelAlign="top">
                    <div className="grid grid-cols-2 gap-3">
                      <Form.FormItem label="提供商" requiredMark>
                        <Select
                          value={modelFormData.provider}
                          onChange={(v) => handleProviderChange(v as string)}
                          style={{ width: '100%' }}
                        >
                          {MODEL_PROVIDERS.map(p => (
                            <Select.Option key={p.value} value={p.value} label={p.label} />
                          ))}
                        </Select>
                      </Form.FormItem>
                      
                      <Form.FormItem label="模型 ID" requiredMark>
                        <Input 
                          value={modelFormData.modelId}
                          onChange={(v) => setModelFormData(prev => ({ ...prev, modelId: v as string }))}
                          placeholder="例如：gpt-4o、deepseek-chat"
                        />
                      </Form.FormItem>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Form.FormItem label="显示名称" requiredMark>
                        <Input 
                          value={modelFormData.name}
                          onChange={(v) => setModelFormData(prev => ({ ...prev, name: v as string }))}
                          placeholder="例如：GPT-4o、DeepSeek Chat"
                        />
                      </Form.FormItem>
                      
                      <Form.FormItem label="描述">
                        <Input 
                          value={modelFormData.description}
                          onChange={(v) => setModelFormData(prev => ({ ...prev, description: v as string }))}
                          placeholder="可选的模型描述"
                        />
                      </Form.FormItem>
                    </div>
                    
                    <Form.FormItem label="Base URL" requiredMark>
                      <Input 
                        value={modelFormData.baseUrl}
                        onChange={(v) => setModelFormData(prev => ({ ...prev, baseUrl: v as string }))}
                        placeholder="https://api.openai.com/v1"
                      />
                    </Form.FormItem>
                    
                    <Form.FormItem label="API Key" requiredMark={!editingModel}>
                      <Input 
                        type="password"
                        value={modelFormData.apiKey}
                        onChange={(v) => setModelFormData(prev => ({ ...prev, apiKey: v as string }))}
                        placeholder={editingModel ? '留空则不修改' : 'sk-...'}
                      />
                    </Form.FormItem>
                  </Form>
                  
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={resetModelForm}>取消</Button>
                    <Button theme="primary" onClick={handleSaveModel}>
                      {editingModel ? '保存修改' : '添加模型'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Button 
                  icon={<AddIcon />} 
                  variant="dashed" 
                  block 
                  onClick={() => setIsCreatingModel(true)}
                >
                  添加自定义模型
                </Button>

                {/* 已有的自定义模型 */}
                {customModels.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
                      已添加的模型 ({customModels.length})
                    </h4>
                    <div className="space-y-2">
                      {customModels.map(model => {
                        const providerLabel = MODEL_PROVIDERS.find(p => p.value === model.provider)?.label || model.provider;
                        return (
                          <div 
                            key={model.id} 
                            className="p-3 rounded-lg"
                            style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: '#0594fa' }}
                              >
                                <Sparkles size={20} color="white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                                    {model.name}
                                  </span>
                                  <Tag size="small" variant="outline" style={{ fontSize: '10px' }}>
                                    {providerLabel}
                                  </Tag>
                                </div>
                                <div className="text-xs truncate" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                  {model.modelId} · {model.baseUrl}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Tooltip content="编辑">
                                  <Button 
                                    variant="text" 
                                    shape="circle" 
                                    size="small"
                                    icon={<EditIcon />}
                                    onClick={() => handleEditModel(model)}
                                  />
                                </Tooltip>
                                <Popconfirm
                                  content="确定删除这个模型吗？"
                                  onConfirm={() => handleDeleteModel(model.id)}
                                >
                                  <Tooltip content="删除">
                                    <Button 
                                      variant="text" 
                                      shape="circle" 
                                      size="small"
                                      icon={<DeleteIcon />}
                                    />
                                  </Tooltip>
                                </Popconfirm>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div 
          style={{ 
            height: '1px', 
            backgroundColor: 'var(--td-component-border)' 
          }} 
        />

        {/* Agent 配置 */}
        <div>
          <div className="mb-4">
            <h2 
              className="text-lg font-medium"
              style={{ color: 'var(--td-text-color-primary)' }}
            >
              Agent 配置
            </h2>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--td-text-color-secondary)' }}
            >
              创建和管理自定义 Agent
            </p>
          </div>

          <div className="space-y-6">
              {/* 创建/编辑表单 */}
              {isCreating ? (
                <div 
                  className="p-5 rounded-xl border"
                  style={{ 
                    backgroundColor: 'var(--td-bg-color-container)',
                    borderColor: 'var(--td-component-border)'
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-base font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                        {editingAgent ? '编辑 Agent' : '创建新 Agent'}
                      </h4>
                      <Button variant="text" onClick={resetForm}>取消</Button>
                    </div>
                    
                    <Form labelAlign="top">
                      <Form.FormItem label="名称" requiredMark>
                        <Input 
                          value={formData.name}
                          onChange={(v) => setFormData(prev => ({ ...prev, name: v as string }))}
                          placeholder="例如：代码助手"
                        />
                      </Form.FormItem>
                      
                      <Form.FormItem label="描述">
                        <Input 
                          value={formData.description}
                          onChange={(v) => setFormData(prev => ({ ...prev, description: v as string }))}
                          placeholder="简短描述这个 Agent 的用途"
                        />
                      </Form.FormItem>
                      
                      <Form.FormItem label="图标和颜色">
                        <div className="flex gap-4">
                          <div className="flex gap-2">
                            {PRESET_ICONS.map(({ name, icon: Icon }) => (
                              <button
                                key={name}
                                type="button"
                                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all border-2"
                                style={{
                                  backgroundColor: formData.icon === name ? formData.color : 'transparent',
                                  color: formData.icon === name ? 'white' : 'var(--td-text-color-secondary)',
                                  borderColor: formData.icon === name ? formData.color : 'var(--td-component-border)',
                                }}
                                onClick={() => setFormData(prev => ({ ...prev, icon: name }))}
                              >
                                <Icon size={18} />
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1.5 items-center">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                type="button"
                                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                                style={{ backgroundColor: color }}
                                onClick={() => setFormData(prev => ({ ...prev, color }))}
                              >
                                {formData.color === color && <CheckIcon style={{ color: 'white' }} size="14px" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </Form.FormItem>
                      
                      <Form.FormItem label="权限模式">
                        <Select
                          value={formData.permissionMode}
                          onChange={(v) => setFormData(prev => ({ ...prev, permissionMode: v as PermissionMode }))}
                          style={{ width: '100%' }}
                        >
                          {PERMISSION_MODES.map(mode => (
                            <Select.Option key={mode.value} value={mode.value} label={mode.label}>
                              <div className="flex flex-col py-1">
                                <span className="font-mono text-sm" style={{ color: 'var(--td-success-color)' }}>
                                  {mode.label}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                  {mode.description}
                                </span>
                              </div>
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.FormItem>
                      
                      <Form.FormItem label="系统提示词" requiredMark>
                        <Textarea 
                          value={formData.systemPrompt}
                          onChange={(v) => setFormData(prev => ({ ...prev, systemPrompt: v as string }))}
                          placeholder="定义 Agent 的行为和能力..."
                          autosize={{ minRows: 4, maxRows: 8 }}
                        />
                      </Form.FormItem>
                    </Form>
                    
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={resetForm}>取消</Button>
                      <Button theme="primary" onClick={handleSave}>
                        {editingAgent ? '保存修改' : '创建 Agent'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 快速模板 */}
                  <div>
                    <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
                      快速创建
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {PRESET_TEMPLATES.map(template => {
                        const Icon = getIconComponent(template.icon);
                        return (
                          <div 
                            key={template.name} 
                            className="p-3 rounded-lg cursor-pointer transition-all hover:shadow-md"
                            style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                            onClick={() => handleUseTemplate(template)}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: template.color }}
                              >
                                <Icon size={20} color="white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate" style={{ color: 'var(--td-text-color-primary)' }}>
                                  {template.name}
                                </div>
                                <div className="text-xs truncate" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                  {template.description}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 自定义创建按钮 */}
                  <Button 
                    icon={<AddIcon />} 
                    variant="dashed" 
                    block 
                    onClick={() => setIsCreating(true)}
                  >
                    从头创建 Agent
                  </Button>

                  {/* 已有的自定义 Agent */}
                  {customAgents.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
                        我的 Agent ({customAgents.length})
                      </h4>
                      <div className="space-y-2">
                        {customAgents.map(agent => {
                          const Icon = getIconComponent(agent.icon || 'Bot');
                          return (
                            <div 
                              key={agent.id} 
                              className="p-3 rounded-lg"
                              style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                            >
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: agent.color || '#0052d9' }}
                                >
                                  <Icon size={20} color="white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                                    {agent.name}
                                  </div>
                                  <div className="text-xs truncate" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                    {agent.description || agent.systemPrompt.slice(0, 50) + '...'}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Tooltip content="编辑">
                                    <Button 
                                      variant="text" 
                                      shape="circle" 
                                      size="small"
                                      icon={<EditIcon />}
                                      onClick={() => handleEdit(agent)}
                                    />
                                  </Tooltip>
                                  <Popconfirm
                                    content="确定删除这个 Agent 吗？"
                                    onConfirm={() => handleDelete(agent.id)}
                                  >
                                    <Tooltip content="删除">
                                      <Button 
                                        variant="text" 
                                        shape="circle" 
                                        size="small"
                                        icon={<DeleteIcon />}
                                      />
                                    </Tooltip>
                                  </Popconfirm>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
        </div>

        <div 
          style={{ 
            height: '1px', 
            backgroundColor: 'var(--td-component-border)' 
          }} 
        />

        {/* 数据库管理 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 
                className="text-lg font-medium"
                style={{ color: 'var(--td-text-color-primary)' }}
              >
                数据库管理
              </h2>
              <p 
                className="text-sm mt-1"
                style={{ color: 'var(--td-text-color-secondary)' }}
              >
                查看数据库状态和管理数据
              </p>
            </div>
            <Button 
              variant="text" 
              icon={<RefreshIcon />}
              onClick={fetchDbStats}
              loading={dbStatsLoading}
            >
              刷新
            </Button>
          </div>

          {dbStats ? (
            <div className="space-y-4">
              {/* 统计卡片 */}
              <div className="grid grid-cols-4 gap-3">
                <div 
                  className="p-4 rounded-lg text-center"
                  style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                >
                  <div 
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--td-brand-color)' }}
                  >
                    {dbStats.sessions}
                  </div>
                  <div 
                    className="text-xs mt-1"
                    style={{ color: 'var(--td-text-color-placeholder)' }}
                  >
                    会话
                  </div>
                </div>
                <div 
                  className="p-4 rounded-lg text-center"
                  style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                >
                  <div 
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--td-brand-color)' }}
                  >
                    {dbStats.messages}
                  </div>
                  <div 
                    className="text-xs mt-1"
                    style={{ color: 'var(--td-text-color-placeholder)' }}
                  >
                    消息
                  </div>
                </div>
                <div 
                  className="p-4 rounded-lg text-center"
                  style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                >
                  <div 
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--td-brand-color)' }}
                  >
                    {dbStats.customModels}
                  </div>
                  <div 
                    className="text-xs mt-1"
                    style={{ color: 'var(--td-text-color-placeholder)' }}
                  >
                    自定义模型
                  </div>
                </div>
                <div 
                  className="p-4 rounded-lg text-center"
                  style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                >
                  <div 
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--td-brand-color)' }}
                  >
                    {dbStats.dbSizeKB >= 1024 ? `${(dbStats.dbSizeKB / 1024).toFixed(1)}M` : `${dbStats.dbSizeKB}K`}
                  </div>
                  <div 
                    className="text-xs mt-1"
                    style={{ color: 'var(--td-text-color-placeholder)' }}
                  >
                    文件大小
                  </div>
                </div>
              </div>

              {/* 表信息 */}
              <div 
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--td-bg-color-component)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-sm font-medium"
                      style={{ color: 'var(--td-text-color-primary)' }}
                    >
                      数据表
                    </span>
                    <span 
                      className="text-xs font-mono"
                      style={{ color: 'var(--td-text-color-placeholder)' }}
                    >
                      ({dbStats.tables.length})
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {dbStats.tables.map(table => (
                      <Tag 
                        key={table} 
                        size="small" 
                        variant="outline"
                        style={{ fontSize: '10px' }}
                      >
                        {table}
                      </Tag>
                    ))}
                  </div>
                </div>
              </div>

              {/* 危险操作 */}
              <div 
                className="p-4 rounded-lg border"
                style={{ 
                  backgroundColor: 'var(--td-bg-color-container)',
                  borderColor: 'var(--td-error-color-border, #fde2e2)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div 
                      className="text-sm font-medium"
                      style={{ color: 'var(--td-text-color-primary)' }}
                    >
                      清空数据库
                    </div>
                    <div 
                      className="text-xs mt-1"
                      style={{ color: 'var(--td-text-color-placeholder)' }}
                    >
                      删除所有会话、消息和自定义模型配置，此操作不可恢复
                    </div>
                  </div>
                  <Popconfirm
                    content="确定要清空数据库吗？所有数据将被永久删除且无法恢复！"
                    onConfirm={handleClearDb}
                  >
                    <Button 
                      theme="danger"
                      variant="outline"
                      size="small"
                      icon={<DeleteIcon />}
                    >
                      清空
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            </div>
          ) : (
            <Button 
              variant="outline" 
              onClick={fetchDbStats}
              loading={dbStatsLoading}
            >
              加载数据库信息
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
