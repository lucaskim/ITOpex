import client from './client';

export interface ReportItem {
  dept_code: string;
  proj_id: string;
  proj_name: string;
  plan_amt: number;
  actual_amt: number;
  diff_amt: number;
  burn_rate: number;
}

export const getBudgetReport = async (year: string) => {
  const response = await client.get<ReportItem[]>(`/report/budget-vs-actual?year=${year}`);
  return response.data;
};