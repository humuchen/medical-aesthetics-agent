/**
 * 权限模式相关常量
 */

import type { PermissionMode } from '../types';

/** 权限模式选项（用于设置页面） */
export const PERMISSION_MODES: { value: PermissionMode; label: string; description: string }[] = [
  { value: 'default', label: 'default', description: '默认模式，所有操作需确认' },
  { value: 'acceptEdits', label: 'acceptEdits', description: '自动批准文件编辑，Bash 仍需确认' },
  { value: 'plan', label: 'plan', description: '规划模式，仅允许读取操作' },
  { value: 'bypassPermissions', label: 'bypassPermissions', description: '跳过所有权限检查（谨慎使用）' },
];

/** 权限模式详细配置（用于聊天输入框） */
export const PERMISSION_MODE_CONFIG: Record<PermissionMode, {
  label: string;
  shortLabel: string;
  color: string;
  description: string;
}> = {
  'default': {
    label: '默认模式',
    shortLabel: '默认',
    color: '#0052d9',
    description: '每次操作都需要确认',
  },
  'acceptEdits': {
    label: '自动编辑',
    shortLabel: '自动编辑',
    color: '#2ba471',
    description: '自动允许文件编辑操作',
  },
  'plan': {
    label: '仅规划',
    shortLabel: '仅规划',
    color: '#ed7b2f',
    description: '只生成计划，不执行操作',
  },
  'bypassPermissions': {
    label: '全部允许',
    shortLabel: '全部允许',
    color: '#e34d59',
    description: '跳过所有权限确认（危险）',
  },
};
