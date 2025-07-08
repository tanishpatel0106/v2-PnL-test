export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export async function fetchCompanyCodes(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/company_codes`);
  if (!res.ok) {
    throw new Error('Failed to fetch company codes');
  }
  const data = await res.json();
  return data.company_codes as string[];
}

export async function fetchSiteCodes(companyCode: string): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/site_codes?company_code=${encodeURIComponent(companyCode)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch site codes');
  }
  const data = await res.json();
  return data.site_codes as string[];
}

export interface AccountOption {
  value: string;
  label: string;
  uniqueId: string;
  isAggregated?: boolean;
}

export async function fetchAccounts(
  companyCode: string,
  siteCode: string
): Promise<AccountOption[]> {
  const params = new URLSearchParams();
  if (companyCode) params.append('company_code', companyCode);
  if (siteCode) params.append('site_code', siteCode);
  const res = await fetch(`${API_BASE_URL}/accounts?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch accounts');
  }
  const data = await res.json();
  return (data.accounts as any[]).map((acc) => ({
    value: acc.value,
    label: acc.label,
    uniqueId: acc.uniqueId,
    isAggregated: acc.isAggregated,
  }));
}

export interface AccountSummaryRequest {
  companyCode: string;
  siteCode: string;
  periods: string[];
  accountNumber: string;
}

export interface AccountSummaryResponse {
  summary: any;
}

export async function fetchAccountSummary(
  req: AccountSummaryRequest
): Promise<AccountSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/account_summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      company_code: req.companyCode,
      site_code: req.siteCode,
      year: parseInt(req.periods[0].split('-')[1]),
      periods: req.periods.map((p) => parseInt(p.split('-')[0].replace('P', ''))),
      account_number: req.accountNumber,
    }),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch account summary');
  }
  const data = await res.json();
  return data as AccountSummaryResponse;
}

export interface GenerateCommentRequest {
  accountId: string;
  companyCode: string;
  siteCode: string;
  periods: string[];
  accountJson: any;
  companyInfo?: string;
}

export interface CommentKey {
  accountId: string;
  companyCode: string;
  siteCode: string;
  periods: string[];
}

export interface StoredComment {
  summary?: string;
  final_comment?: string;
  approved_comment?: string;
  approved_by?: string | null;
  approved_on?: string | null;
}

export interface GenerateCommentResponse {
  summary: string;
  final_comment: string;
}

export async function generateComment(
  req: GenerateCommentRequest
): Promise<GenerateCommentResponse> {
  const res = await fetch(`${API_BASE_URL}/comments/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_id: req.accountId,
      company_code: req.companyCode,
      site_code: req.siteCode,
      periods: req.periods,
      account_json: req.accountJson,
      company_info: req.companyInfo || '',
    }),
  });
  if (!res.ok) {
    throw new Error('Failed to generate comment');
  }
  const data = await res.json();
  return data as GenerateCommentResponse;
}

export async function fetchComment(
  key: CommentKey
): Promise<StoredComment | null> {
  const params = new URLSearchParams({
    account_id: key.accountId,
    company_code: key.companyCode,
    site_code: key.siteCode,
    periods: key.periods.join(',')
  });
  const res = await fetch(`${API_BASE_URL}/comments?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch comment');
  }
  const data = await res.json();
  if (data.comment === null) return null;
  return data as StoredComment;
}

export async function regenerateComment(
  key: GenerateCommentRequest
): Promise<GenerateCommentResponse> {
  const res = await fetch(`${API_BASE_URL}/comments/regenerate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_id: key.accountId,
      company_code: key.companyCode,
      site_code: key.siteCode,
      periods: key.periods,
      account_json: key.accountJson,
      company_info: key.companyInfo || ''
    })
  });
  if (!res.ok) {
    throw new Error('Failed to regenerate comment');
  }
  const data = await res.json();
  return data as GenerateCommentResponse;
}

export async function approveComment(
  key: CommentKey & { comment: string; user?: string }
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/comments/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id: key.accountId,
      company_code: key.companyCode,
      site_code: key.siteCode,
      periods: key.periods,
      comment: key.comment,
      user: key.user || 'AI.Admin'
    })
  });
  if (!res.ok) {
    throw new Error('Failed to approve comment');
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface FollowUpChatRequest {
  message: string
  history: ChatMessage[]
  companyInfo?: string
}

export interface FollowUpChatResponse {
  reply: string
}

export async function sendFollowUpMessage(
  req: FollowUpChatRequest
): Promise<FollowUpChatResponse> {
  const res = await fetch(`${API_BASE_URL}/followup_chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: req.message,
      history: req.history,
      company_info: req.companyInfo || '',
    }),
  })

  if (!res.ok) {
    throw new Error('Failed to send follow up message')
  }
  const data = await res.json()
  return data as FollowUpChatResponse
}


// ----- Monthly Analysis API -----
export async function fetchMonthlyCompanyCodes(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/monthly/company_codes`)
  if (!res.ok) {
    throw new Error('Failed to fetch company codes')
  }
  const data = await res.json()
  return data.company_codes as string[]
}

export async function fetchMonthlySiteCodes(companyCode: string): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/monthly/site_codes?company_code=${encodeURIComponent(companyCode)}`)
  if (!res.ok) {
    throw new Error('Failed to fetch site codes')
  }
  const data = await res.json()
  return data.site_codes as string[]
}

export interface MonthlyCommentKey {
  companyCode: string
  siteCode: string
  year: string
  period: string
}

export interface MonthlyStoredComment {
  monthly_summary?: string
  approved_summary?: string | null
  approved_by?: string | null
  approved_on?: string | null
}

export async function fetchMonthlyComment(key: MonthlyCommentKey): Promise<MonthlyStoredComment | null> {
  const params = new URLSearchParams({
    company_code: key.companyCode,
    site_code: key.siteCode,
    year: key.year,
    period: key.period,
  })
  const res = await fetch(`${API_BASE_URL}/monthly/comment?${params.toString()}`)
  if (!res.ok) {
    throw new Error('Failed to fetch comment')
  }
  const data = await res.json()
  if (data.comment === null) return null
  return data as MonthlyStoredComment
}

export async function updateMonthlyComment(req: MonthlyCommentKey & { monthlySummary: string }): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/monthly/comment/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_code: req.companyCode,
      site_code: req.siteCode,
      year: req.year,
      period: req.period,
      monthly_summary: req.monthlySummary,
    }),
  })
  if (!res.ok) {
    throw new Error('Failed to save comment')
  }
}

export async function approveMonthlyComment(req: MonthlyCommentKey & { summary: string; user?: string }): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/monthly/comment/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_code: req.companyCode,
      site_code: req.siteCode,
      year: req.year,
      period: req.period,
      summary: req.summary,
      user: req.user || 'AI.Admin',
    }),
  })
  if (!res.ok) {
    throw new Error('Failed to approve comment')
  }
}

export interface MonthlyFollowUpRequest {
  message: string
  history: ChatMessage[]
  companyInfo?: string
}

export async function monthlyFollowUpMessage(req: MonthlyFollowUpRequest): Promise<FollowUpChatResponse> {
  const res = await fetch(`${API_BASE_URL}/monthly/followup_chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: req.message,
      history: req.history,
      company_info: req.companyInfo || '',
    }),
  })
  if (!res.ok) {
    throw new Error('Failed to send follow up message')
  }
  const data = await res.json()
  return data as FollowUpChatResponse
}

export async function monthlyRegenerateRequest(req: MonthlyCommentKey & { email: string; reason: string }): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/monthly/regenerate_request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_code: req.companyCode,
      site_code: req.siteCode,
      year: req.year,
      period: req.period,
      email: req.email,
      reason: req.reason,
    }),
  })
  if (!res.ok) {
    throw new Error('Failed to submit request')
  }
}

// ----- Forecast API -----
export interface ForecastParams {
  companyCode: string
  siteCode: string
  year: string
  period: string
}

export interface ForecastData {
  date: string
  forecast: number
  approved?: number | null
}

export interface ForecastResponse {
  forecast: ForecastData[]
  message?: string
}

export interface ForecastApprovalEntry {
  date: string
  income?: number | null
  cogs?: number | null
  expense?: number | null
}

export interface ApproveForecastRequest extends ForecastParams {
  entries: ForecastApprovalEntry[]
  user?: string
}

export async function fetchForecast(
  type: 'income' | 'cogs' | 'expense',
  params: ForecastParams,
): Promise<ForecastResponse> {
  const qs = new URLSearchParams({
    company: params.companyCode,
    site: params.siteCode,
    year: params.year,
    period: params.period,
  })
  const res = await fetch(`${API_BASE_URL}/forecast/${type}?${qs.toString()}`)
  if (!res.ok) {
    throw new Error('Failed to fetch forecast')
  }
  const data = await res.json()
  return data as ForecastResponse
}

export interface ActualsResponse {
  actuals: { date: string; actual: number }[]
}

export async function fetchForecastActuals(
  type: 'income' | 'cogs' | 'expense',
  params: ForecastParams,
): Promise<ActualsResponse> {
  const qs = new URLSearchParams({
    company: params.companyCode,
    site: params.siteCode,
    year: params.year,
    period: params.period,
  })
  const res = await fetch(`${API_BASE_URL}/forecast/${type}_actuals?${qs.toString()}`)
  if (!res.ok) {
    throw new Error('Failed to fetch actuals')
  }
  const data = await res.json()
  return data as ActualsResponse
}

export async function approveForecast(req: ApproveForecastRequest): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/forecast/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_code: req.companyCode,
      site_code: req.siteCode,
      year: req.year,
      period: req.period,
      entries: req.entries,
      user: req.user || 'AI.Admin',
    }),
  })
  if (!res.ok) {
    throw new Error('Failed to approve forecast')
  }
}
