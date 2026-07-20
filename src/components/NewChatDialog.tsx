import { useState, useEffect, useMemo } from 'react';
import { Dialog, Select, Button } from 'tdesign-react';
import { CustomAgent, Model } from '../types';

interface NewChatDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (agentId: string, model: string, cwd?: string) => void;
  agents: CustomAgent[];
  models: Model[];
  defaultModel: string;
  defaultAgentId?: string;
  defaultCwd?: string;
}

export function NewChatDialog({
  visible,
  onClose,
  onConfirm,
  models,
  defaultModel,
  defaultAgentId = 'default',
  defaultCwd,
}: NewChatDialogProps) {
  const [selectedModel, setSelectedModel] = useState(defaultModel);

  // 计算有效的模型值
  const effectiveModel = useMemo(() => {
    if (models.length === 0) return '';
    if (selectedModel && models.some(m => m.modelId === selectedModel)) {
      return selectedModel;
    }
    if (defaultModel && models.some(m => m.modelId === defaultModel)) {
      return defaultModel;
    }
    return models[0]?.modelId || '';
  }, [selectedModel, defaultModel, models]);

  useEffect(() => {
    if (models.length > 0) {
      if (!selectedModel || !models.some(m => m.modelId === selectedModel)) {
        const validModel = defaultModel && models.some(m => m.modelId === defaultModel)
          ? defaultModel
          : models[0]?.modelId || '';
        setSelectedModel(validModel);
      }
    }
  }, [defaultModel, models]);

  const handleConfirm = () => {
    onConfirm(defaultAgentId, effectiveModel, defaultCwd || undefined);
    setSelectedModel(effectiveModel);
  };

  const handleClose = () => {
    setSelectedModel(effectiveModel);
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      onClose={handleClose}
      header="新建对话"
      width={500}
      confirmBtn={
        <Button theme="primary" onClick={handleConfirm}>
          开始对话
        </Button>
      }
      cancelBtn={
        <Button variant="outline" onClick={handleClose}>
          取消
        </Button>
      }
    >
      <div className="space-y-5 py-2">
        {/* 模型选择 */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--td-text-color-primary)' }}>
            选择模型
          </label>
          <Select
            value={effectiveModel}
            onChange={(v) => setSelectedModel(v as string)}
            placeholder="选择模型"
            style={{ width: '100%' }}
            filterable
          >
            {models.map(model => (
              <Select.Option key={model.modelId} value={model.modelId} label={model.name} />
            ))}
          </Select>
        </div>

        <p className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
          Agent 和工作目录请在「设置 → 默认对话配置」中修改
        </p>
      </div>
    </Dialog>
  );
}
