export interface WeatherCodeInfo {
  description: string;
  icon: string;
}

export function weatherCodeInfo(code: number): WeatherCodeInfo;

export function unitLabels(units: string): { temp: string; wind: string; rain: string };

export function generateRuleAnswer(args?: {
  question?: string;
  location?: { name?: string };
  daily?: any[];
  hourly?: any[];
  units?: string;
}): { answer: string; provider: 'rules'; disclaimer: string };

export function generateAIAnswer(args?: {
  question?: string;
  location?: { name?: string };
  daily?: any[];
  hourly?: any[];
  units?: string;
  fetchImpl?: any;
}): Promise<{ answer: string; provider: 'rules' | 'ai'; disclaimer: string; fallbackReason?: string }>;

export function evaluateRule(
  rule: { metric: string; operator: string; threshold: number; leadMinutes?: number },
  forecast: { hourly: any[]; units: string },
  airQuality?: number | null
): { triggered: boolean; value: number | null; reason: string };

export const DISCLAIMER: string;
