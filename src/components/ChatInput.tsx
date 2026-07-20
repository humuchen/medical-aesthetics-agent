import { useRef, useCallback } from 'react';
import { Select, Tooltip } from 'tdesign-react';
import { ChatSender } from '@tdesign-react/chat';
import { ChevronDownIcon, LockOnIcon, LockOffIcon, EditIcon, TaskIcon } from 'tdesign-icons-react';
import { Model, PermissionMode } from '../types';
import { PERMISSION_MODE_CONFIG } from '../constants/permission';

interface ChatInputProps {
  inputValue: string;
  selectedModel: string;
  models: Model[];
  isLoading: boolean;
  permissionMode: PermissionMode;
  onSend: (message: string) => void;
  onStop: () => void;
  onChange: (value: string) => void;
  onModelChange: (modelId: string) => void;
  onPermissionModeChange: (mode: PermissionMode) => void;
}

// 权限模式图标映射
const PERMISSION_MODE_ICONS: Record<PermissionMode, React.ReactNode> = {
  'default': <LockOnIcon />,
  'acceptEdits': <EditIcon />,
  'plan': <TaskIcon />,
  'bypassPermissions': <LockOffIcon />,
};

export function ChatInput({
  inputValue,
  selectedModel,
  models,
  isLoading,
  permissionMode,
  onSend,
  onStop,
  onChange,
  onModelChange,
  onPermissionModeChange,
}: ChatInputProps) {
  const chatSenderRef = useRef<any>(null);

  const handleSend = useCallback((e: any) => {
    console.log('ChatSender send event:', e);
    const content = e?.detail?.message || e?.detail || e?.message || inputValue;
    if (content && typeof content === 'string' && content.trim() && selectedModel) {
      onSend(content.trim());
    } else if (inputValue.trim() && selectedModel) {
      onSend(inputValue.trim());
    }
  }, [inputValue, selectedModel, onSend]);

  const handleChange = useCallback((e: any) => {
    console.log('ChatSender change event:', e);
    const value = e?.detail ?? e ?? '';
    onChange(typeof value === 'string' ? value : '');
  }, [onChange]);

  const currentModeConfig = PERMISSION_MODE_CONFIG[permissionMode];

  return (
    <div 
      className="px-4 pb-6 pt-4"
      style={{ 
        backgroundColor: 'var(--td-bg-color-page)'
      }}
    >
      <div className="max-w-3xl mx-auto">
        <ChatSender
          ref={chatSenderRef}
          value={inputValue}
          placeholder="输入消息..."
          disabled={!selectedModel}
          loading={isLoading}
          autosize={{ minRows: 1, maxRows: 6 }}
          actions={['send']}
          onSend={handleSend}
          onStop={onStop}
          onChange={handleChange}
        >
          {/* 模型选择器和权限模式选择器放在 footer-prefix 插槽 */}
          <div slot="footer-prefix" className="flex items-center gap-2">
            {/* 模型选择器 */}
            <Select
              value={selectedModel}
              onChange={(value) => onModelChange(value as string)}
              placeholder="选择模型"
              size="small"
              style={{ width: 160 }}
              filterable
              borderless
              suffixIcon={<ChevronDownIcon />}
            >
              {models.map(model => (
                <Select.Option key={model.modelId} value={model.modelId} label={model.name}>
                  <div className="flex items-center gap-1.5">
                    {model.isCustom && <span style={{ color: '#0594fa', fontSize: 10 }}>★</span>}
                    <span>{model.name}</span>
                  </div>
                </Select.Option>
              ))}
            </Select>
            
            {/* 分隔线 */}
            <div 
              className="h-4 w-px"
              style={{ backgroundColor: 'var(--td-component-stroke)' }}
            />
            
            {/* 权限模式选择器 */}
            <Tooltip content={currentModeConfig.description} placement="top">
              <Select
                value={permissionMode}
                onChange={(value) => onPermissionModeChange(value as PermissionMode)}
                size="small"
                style={{ width: 110 }}
                borderless
                suffixIcon={<ChevronDownIcon />}
                prefixIcon={
                  <span style={{ color: currentModeConfig.color }}>
                    {PERMISSION_MODE_ICONS[permissionMode]}
                  </span>
                }
                popupProps={{
                  overlayInnerStyle: { width: 140 }
                }}
              >
                {(Object.keys(PERMISSION_MODE_CONFIG) as PermissionMode[]).map(mode => {
                  const config = PERMISSION_MODE_CONFIG[mode];
                  return (
                    <Select.Option 
                      key={mode} 
                      value={mode} 
                      label={config.shortLabel}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: config.color }}>{PERMISSION_MODE_ICONS[mode]}</span>
                        <span>{config.shortLabel}</span>
                      </div>
                    </Select.Option>
                  );
                })}
              </Select>
            </Tooltip>
          </div>
        </ChatSender>
      </div>
    </div>
  );
}
