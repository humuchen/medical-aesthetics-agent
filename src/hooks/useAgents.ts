import { useState, useEffect, useCallback } from 'react';
import { CustomAgent } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'customAgents';

// 默认的 Agent（医美行业数据整合 / 分析 / 运营决策）
const MEDICAL_AESTHETICS_SYSTEM_PROMPT = `你是「医美数据决策助手」，一名深耕医疗美容行业的运营数据分析与决策支持专家，服务于医美机构/连锁的运营、店长、市场与咨询师团队。

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

// 默认的 Agent
const DEFAULT_AGENT: CustomAgent = {
  id: 'default',
  name: '医美运营决策助手',
  description: '整合医美多源数据，分析经营与运营指标，给出可落地的决策建议',
  systemPrompt: MEDICAL_AESTHETICS_SYSTEM_PROMPT,
  icon: 'HeartPulse',
  color: '#e8538a',
  permissionMode: 'bypassPermissions',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function useAgents() {
  const [agents, setAgents] = useState<CustomAgent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return [DEFAULT_AGENT, ...parsed.map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        }))];
      }
    } catch (e) {
      console.error('Failed to load agents:', e);
    }
    return [DEFAULT_AGENT];
  });

  // 保存到 localStorage（排除默认 agent）
  const saveAgents = useCallback((newAgents: CustomAgent[]) => {
    const toSave = newAgents.filter(a => a.id !== 'default');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, []);

  const addAgent = useCallback((agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAgent: CustomAgent = {
      ...agent,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setAgents(prev => {
      const updated = [...prev, newAgent];
      saveAgents(updated);
      return updated;
    });
    return newAgent;
  }, [saveAgents]);

  const updateAgent = useCallback((id: string, updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>) => {
    setAgents(prev => {
      const updated = prev.map(a => 
        a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a
      );
      saveAgents(updated);
      return updated;
    });
  }, [saveAgents]);

  const deleteAgent = useCallback((id: string) => {
    if (id === 'default') return; // 不能删除默认 agent
    setAgents(prev => {
      const updated = prev.filter(a => a.id !== id);
      saveAgents(updated);
      return updated;
    });
  }, [saveAgents]);

  const getAgent = useCallback((id: string) => {
    return agents.find(a => a.id === id);
  }, [agents]);

  return {
    agents,
    addAgent,
    updateAgent,
    deleteAgent,
    getAgent,
    defaultAgent: DEFAULT_AGENT,
  };
}
