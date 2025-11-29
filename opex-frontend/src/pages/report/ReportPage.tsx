import React, { useEffect, useState } from 'react';
import { Table, Card, DatePicker, Button, Tag, Progress } from 'antd';
import { ReloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
// [수정 1] type 키워드 추가
import { getBudgetReport, type ReportItem } from '../../api/reportApi';

const ReportPage: React.FC = () => {
  const [data, setData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(dayjs().format('YYYY'));

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await getBudgetReport(year);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [year]);

  const columns = [
    { 
      title: '부서', 
      dataIndex: 'dept_code', 
      width: 80,
      filters: [
        { text: 'DX운영(A)', value: 'A' },
        { text: 'DX기획(B)', value: 'B' },
        { text: '보안(C)', value: 'C' },
      ],
      onFilter: (value: any, record: ReportItem) => record.dept_code === value,
      render: (v: string) => <Tag color="blue">{v}</Tag> 
    },
    { title: '사업명', dataIndex: 'proj_name', width: 250 },
    { 
      title: '연간 계획', 
      dataIndex: 'plan_amt', 
      align: 'right' as const, 
      render: (v: number) => v.toLocaleString(),
      sorter: (a: ReportItem, b: ReportItem) => a.plan_amt - b.plan_amt,
    },
    { 
      title: '누적 실적', 
      dataIndex: 'actual_amt', 
      align: 'right' as const, 
      render: (v: number) => <b>{v.toLocaleString()}</b> 
    },
    { 
      title: '잔여 예산', 
      dataIndex: 'diff_amt', 
      align: 'right' as const, 
      render: (v: number) => <span style={{ color: v < 0 ? 'red' : 'inherit' }}>{v.toLocaleString()}</span> 
    },
    {
      title: '소진율',
      dataIndex: 'burn_rate',
      width: 180,
      render: (v: number) => (
        <Progress 
          percent={v} 
          size="small" 
          status={v > 100 ? 'exception' : 'active'} 
          strokeColor={v > 90 ? '#faad14' : '#52c41a'}
        />
      ),
      sorter: (a: ReportItem, b: ReportItem) => a.burn_rate - b.burn_rate,
    }
  ];

  return (
    <div style={{ padding: 20 }}>
      <h3>📊 부서별 예실 대비 현황 ({year}년)</h3>
      
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <span style={{ marginRight: 8 }}>기준 연도:</span>
            <DatePicker 
              picker="year" 
              defaultValue={dayjs()} 
              // [수정 2] 타입 에러 해결 (문자열인지 확인 후 set)
              onChange={(_, dateString) => {
                if (typeof dateString === 'string') {
                  setYear(dateString);
                }
              }}
              allowClear={false}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ marginLeft: 8 }}>조회</Button>
          </div>
          <Button icon={<FileExcelOutlined />}>엑셀 다운로드</Button>
        </div>

        <Table 
          dataSource={data} 
          columns={columns} 
          rowKey="proj_id" 
          loading={loading}
          pagination={{ pageSize: 20 }}
          summary={(pageData) => {
            let totalPlan = 0;
            let totalActual = 0;
            pageData.forEach(({ plan_amt, actual_amt }) => {
              totalPlan += plan_amt;
              totalActual += actual_amt;
            });
            return (
              <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                <Table.Summary.Cell index={0} colSpan={2}>총 계</Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">{totalPlan.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">{totalActual.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">{(totalPlan - totalActual).toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="center">
                  {totalPlan > 0 ? ((totalActual / totalPlan) * 100).toFixed(1) : 0}%
                </Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Card>
    </div>
  );
};

export default ReportPage;