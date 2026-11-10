import type { ConnectionKind, LauncherState, Placement, Preferences, WorkflowPage, InsightsSummary } from './types';
export {};
declare module 'orca' {
  interface PluginRequests {
    'n8n.state': { output: LauncherState };
    'n8n.connect': { input: { baseUrl: string; connectionKind?: ConnectionKind }; output: { preferences: Preferences; checkedAt: string } };
    'n8n.preview-connection': { input: { baseUrl: string; connectionKind: ConnectionKind }; output: { baseUrl: string; connectionKind: ConnectionKind; checkedAt: string } };
    'n8n.configure': { input: { baseUrl: string; connectionKind: ConnectionKind; apiKey?: string; removeKey?: boolean; refreshIntervalSeconds?: number }; output: { preferences: Preferences; hasApiKey: boolean } };
    'n8n.delete-connection': { input: { baseUrl: string; connectionKind: ConnectionKind }; output: Preferences };
    'n8n.workflows': { input: { cursor?: string } | undefined; output: WorkflowPage };
    'n8n.insights': { output: InsightsSummary };
    'n8n.open': { input: { placement: Placement; intent?: 'new-workflow' | 'api-settings'; workflowId?: string; preview?: boolean; baseUrl?: string; connectionKind?: ConnectionKind }; output: { browserPageId: string; preferences: Preferences } };
    'n8n.complete': { input: { baseUrl: string; connectionKind: ConnectionKind; placement: Placement } | undefined; output: Preferences };
    'n8n.reset-onboarding': { output: Preferences };
  }
}
