export const DEFAULT_URL = 'http://localhost:5678/';
export const REFRESH_INTERVALS = [0, 15, 30, 60, 120, 300] as const;
export type Placement = 'tab' | 'right' | 'down';
export type ConnectionKind = 'local' | 'cloud';
export interface Preferences {
  baseUrl: string;
  placement: Placement;
  onboardingCompleted: boolean;
  lastOpenedAt?: string;
  connectionKind?: ConnectionKind;
  refreshIntervalSeconds?: number;
}
export interface WorkspaceTarget { selector: string; name: string; path: string; active: boolean }
export interface LauncherState { preferences: Preferences; hasApiKey: boolean; hasConnection: boolean }
export interface WorkflowSummary { id: string; name: string; state: 'published' | 'draft' | 'archived' | 'unknown'; nodeCount?: number; updatedAt?: string; recentRun?: { id: string; status: string; startedAt?: string } }
export interface WorkflowPage { data: WorkflowSummary[]; nextCursor?: string; executionWarning?: string }
export interface InsightsSummary { total: number; failed: number; failureRate: number; timeSavedMinutes: number; averageRunTimeMs: number; startDate: string; endDate: string }
