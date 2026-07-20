import { Bot } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { Model, Agent, PermissionMode } from '../types';
import { ICON_MAP } from '../utils/iconMap';
import { EXAMPLE_PROMPTS } from '../constants/agent';

interface NewChatViewProps {
  agents: Agent[];
  models: Model[];
  selectedModel: string;
  newChatAgentId: string;
  newChatCwd: string;
  newChatPermissionMode: PermissionMode;
  onSelectModel: (modelId: string) => void;
  onSelectAgent: (agentId: string) => void;
  onSetCwd: (cwd: string) => void;
  onSetPermissionMode: (mode: PermissionMode) => void;
  onExampleClick?: (text: string) => void;
}

export function NewChatView({
  agents,
  newChatAgentId,
  newChatCwd,
  onExampleClick,
}: NewChatViewProps) {
  const selectedAgent = agents.find(a => a.id === newChatAgentId);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-full max-w-lg">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg mx-auto"
            style={{ 
              background: 'linear-gradient(135deg, var(--td-brand-color), var(--td-brand-color-hover))'
            }}
          >
            <span className="text-3xl font-bold text-white">{APP_CONFIG.nameInitial}</span>
          </div>
          <h2 
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            {APP_CONFIG.name}
          </h2>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            开始新对话
          </p>
        </div>

        {/* 当前默认 Agent 预览 */}
        {selectedAgent && (
          <div 
            className="p-4 rounded-xl mb-6"
            style={{ backgroundColor: 'var(--td-bg-color-component)' }}
          >
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = ICON_MAP[selectedAgent.icon || 'Bot'] || Bot;
                return (
                  <>
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: selectedAgent.color || '#0052d9' }}
                    >
                      <Icon size={18} color="white" />
                    </div>
                    <div>
                      <span className="text-sm font-medium block" style={{ color: 'var(--td-text-color-primary)' }}>
                        {selectedAgent.name}
                      </span>
                      {selectedAgent.description && (
                        <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                          {selectedAgent.description}
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            {newChatCwd && (
              <div className="mt-2 text-xs font-mono truncate" style={{ color: 'var(--td-text-color-placeholder)' }}>
                📁 {newChatCwd}
              </div>
            )}
            <p className="text-xs mt-2" style={{ color: 'var(--td-text-color-placeholder)' }}>
              可在「设置 → 默认对话配置」中修改默认 Agent 和工作目录
            </p>
          </div>
        )}
        
        {/* 示例提问 */}
        {onExampleClick && (
          <div className="mb-6">
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-primary)' }}>
              试试这样问
            </p>
            <div className="grid grid-cols-2 gap-3">
              {EXAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onExampleClick(prompt)}
                  className="text-left text-xs px-3 py-2.5 rounded-lg transition-all border border-transparent hover:border-[var(--td-brand-color)] line-clamp-2"
                  style={{ backgroundColor: 'var(--td-bg-color-component)', color: 'var(--td-text-color-secondary)' }}
                  title={prompt}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 提示文字 */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--td-text-color-placeholder)' }}>
          模型和权限模式可在输入框下方切换
        </p>
      </div>
    </div>
  );
}
