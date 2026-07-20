import { useState, useEffect, useCallback } from 'react';
import { Model, CustomModel } from '../types';

const STORAGE_KEY = 'defaultModel';

// 将 CustomModel 转为 Model
function customModelToModel(cm: CustomModel): Model {
  return {
    modelId: cm.modelId,
    name: `⭐ ${cm.name}`,  // 加星号标识自定义模型
    description: `${cm.provider} | ${cm.baseUrl}`,
    isCustom: true,
  };
}

export function useModels() {
  const [models, setModels] = useState<Model[]>([]);
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });

  const fetchCustomModels = useCallback(async () => {
    try {
      const res = await fetch('/api/custom-models');
      const data = await res.json();
      const cms: CustomModel[] = (data.models || []).map((m: any) => ({
        id: m.id,
        modelId: m.model_id,
        name: m.name,
        description: m.description || undefined,
        provider: m.provider,
        baseUrl: m.base_url,
        apiKey: m.api_key,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      }));
      setCustomModels(cms);
      return cms;
    } catch (error) {
      console.error('Failed to fetch custom models:', error);
      return [];
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      // 并行获取 API 模型和自定义模型
      const [apiRes, cms] = await Promise.all([
        fetch('/api/models').then(r => r.json()),
        fetchCustomModels(),
      ]);

      const apiModels: Model[] = apiRes.models || [];
      const customModelList: Model[] = cms.map(customModelToModel);

      // 合并：自定义模型放在前面
      const allModels = [...customModelList, ...apiModels];
      setModels(allModels);

      if (allModels.length > 0 && !selectedModel) {
        const savedDefault = localStorage.getItem(STORAGE_KEY);
        const modelToUse = savedDefault && allModels.some(m => m.modelId === savedDefault)
          ? savedDefault
          : (apiRes.defaultModel || allModels[0].modelId);
        setSelectedModel(modelToUse);
        localStorage.setItem(STORAGE_KEY, modelToUse);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  }, [selectedModel, fetchCustomModels]);

  // 初始加载
  useEffect(() => {
    fetchModels();
  }, []);

  return {
    models,
    customModels,
    selectedModel,
    setSelectedModel,
    fetchModels,
    fetchCustomModels,
  };
}
