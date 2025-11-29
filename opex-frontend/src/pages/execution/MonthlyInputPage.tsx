import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
    Table, InputNumber, message, Tag, Card, Statistic, 
    Alert, DatePicker, Typography, Button, Space, Row, Col // Row, Col 다시 사용
} from 'antd';
import { ReloadOutlined, UploadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getMonthlyStatus, updateForecast, finalizeMonthlyActuals } from '../../api/executionApi';
import { getClosingStatus } from '../../api/closingApi'; 
import SapUploadModal from './SapUploadModal';
import type { MonthlyStatus, ClosingStatus } from '../../types';

const { Text } = Typography;

const MonthlyInputPage: React.FC = () => {
  const [data, setData] = useState<MonthlyStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  // ▼▼▼ [수정 1] 년도와 월 상태 분리 ▼▼▼
  const [selectedYear, setSelectedYear] = useState(dayjs().format('YYYY'));
  // dayjs().month()는 0부터 시작하므로 +1
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(dayjs().month() + 1); 
  // ▲▲▲ ▲▲▲ ▲▲▲
  
  const [closingStatus, setClosingStatus] = useState<ClosingStatus>({ yyyymm: dayjs().format('YYYYMM'), status: 'OPEN' });

  // ▼▼▼ [수정 2] 현재 YYYYMM은 두 상태에서 파생 ▼▼▼
  const currentYYYYMM = useMemo(() => 
    `${selectedYear}${String(selectedMonthIndex).padStart(2, '0')}`, 
    [selectedYear, selectedMonthIndex]
  );
  // ▲▲▲ ▲▲▲ ▲▲▲

  // ==========================================
  // 1. 데이터 로드 (실적 데이터 + 마감 상태)
  // ==========================================
  const fetchData = useCallback(async (yyyymm: string) => {
    setLoading(true);
    try {
      const result = await getMonthlyStatus(yyyymm);
      const statusResult = await getClosingStatus(yyyymm);
      
      setData(result);
      setClosingStatus(statusResult);
    } catch (err) {
      message.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // currentYYYYMM이 변경될 때마다 fetch
    fetchData(currentYYYYMM); 
  }, [currentYYYYMM, fetchData]); 

  // ==========================================
  // 2. 금액 수정 핸들러 (Forecast Update)
  // ==========================================
  const handleAmountChange = async (val: number | null, record: MonthlyStatus) => {
    if (val === null) return;

    if (closingStatus.status === 'CLOSED') {
        message.error('🔒 해당 월은 마감되어 수정할 수 없습니다.');
        return; 
    }
    
    try {
      await updateForecast(record.proj_id, currentYYYYMM, val); 
      message.success(`${currentYYYYMM} 저장됨`, 0.5);
      fetchData(currentYYYYMM);
      
    } catch (err: any) {
      message.error(err.response?.data?.detail || '저장 실패');
    }
  };
  
  // ==========================================
  // 3. 실적 확정 처리 핸들러 (Finalize)
  // ==========================================
  const handleFinalize = async () => {
    if (window.confirm(`${dayjs(currentYYYYMM, 'YYYYMM').format('YYYY년 MM월')}의 실적을 최종 확정 처리하시겠습니까?`)) {
        try {
            await finalizeMonthlyActuals(currentYYYYMM);
            message.success('실적이 최종 확정되었습니다. 데이터가 잠깁니다.');
            fetchData(currentYYYYMM);
        } catch (error: any) {
            message.error(error.response?.data?.detail || '확정 처리 중 오류가 발생했습니다.');
        }
    }
  };

  // ==========================================
  // 4. 테이블 컬럼 정의 및 통계 계산
  // ==========================================
  const columns = [
    { title: 'Index', dataIndex: 'proj_id', width: 90, fixed: 'left' as const },
    { title: '사업명', dataIndex: 'proj_name', width: 250, fixed: 'left' as const, ellipsis: true },
    { title: '부서', dataIndex: 'dept_code', width: 60, render: (v:string) => <Tag color="blue">{v}</Tag> },
    { title: '업체명', dataIndex: 'vendor_name', width: 150, ellipsis: true },
    { 
      title: '계획 예산', 
      dataIndex: 'plan_amt', 
      width: 120, 
      align: 'right' as const,
      render: (v:number) => v.toLocaleString() 
    },
    { 
      title: 'SAP 실적 (확정)', 
      dataIndex: 'actual_amt', 
      width: 120, 
      align: 'right' as const,
      render: (v:number) => <span style={{color: '#555'}}>{v.toLocaleString()}</span>
    },
    { 
      title: '당월 추정 (입력)', 
      dataIndex: 'est_amt', 
      width: 140,
      render: (val: number, record: MonthlyStatus) => (
        <InputNumber
          value={val}
          // 마감되거나 확정되면 비활성화
          disabled={closingStatus.status === 'CLOSED' || record.is_actual_finalized === 'Y'} 
          style={{ width: '100%', backgroundColor: (closingStatus.status === 'CLOSED' || record.is_actual_finalized === 'Y') ? '#f2f2f2' : '#fff7e6' }} 
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
          onBlur={(e) => handleAmountChange(parseFloat(e.target.value.replace(/,/g, '')), record)}
        />
      )
    },
    {
      title: '집행률',
      width: 100,
      render: (_: any, r: MonthlyStatus) => {
        const target = r.actual_amt > 0 ? r.actual_amt : r.est_amt;
        const ratio = r.plan_amt > 0 ? (target / r.plan_amt) * 100 : 0;
        const color = ratio > 100 ? 'red' : ratio > 90 ? 'orange' : 'green';
        return <span style={{ color, fontWeight: 'bold' }}>{ratio.toFixed(1)}%</span>
      }
    }
  ];
  
  // 통계 계산
  const totalPlan = data.reduce((acc, cur) => acc + cur.plan_amt, 0);
  const totalActual = data.reduce((acc, cur) => acc + cur.actual_amt, 0);
  const totalEst = data.reduce((acc, cur) => acc + cur.est_amt, 0);
  // 확정된 SAP 실적이 있으면 그것을 사용하고, 없으면 추정 금액을 사용
  const totalSpend = totalActual > 0 ? totalActual : totalEst; 
  const totalBurnRate = totalPlan > 0 ? (totalSpend / totalPlan * 100).toFixed(1) : 0;
  
  const isClosed = closingStatus.status === 'CLOSED';
  // 데이터의 모든 행이 is_actual_finalized='Y'일 경우 최종 확정으로 간주
  const isFinalized = data.length > 0 && data.every(d => d.is_actual_finalized === 'Y');
  
  const MONTHS_ARRAY = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div style={{ height: '100%', padding: 20 }}>
      {/* 마감 상태 인지 Alert */}
      {(isClosed || isFinalized) && (
        <Alert 
          message={`🔒 ${dayjs(currentYYYYMM, 'YYYYMM').format('YYYY년 MM월')} 데이터 ${isFinalized ? '최종 확정' : '마감'} 완료`}
          description={isFinalized ? "해당 월의 실적은 최종 확정되어 수정이 불가능합니다." : "해당 월은 마감되어 수정이 불가능합니다. 수정이 필요하면 '기준정보 관리'에서 마감을 해제하세요."}
          type={isFinalized ? 'success' : 'error'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      
      {/* 조회 및 업로드 컨트롤 카드 */}
      <Card title="월별 실적 입력/검증 컨트롤" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
            {/* 년도 선택 및 기본 컨트롤 */}
            <Col span={24}>
                <Space size="middle">
                    <span style={{ fontWeight: 'bold' }}>기준 연도 선택:</span>
                    {/* ▼▼▼ [수정 3] Year Picker ▼▼▼ */}
                    <DatePicker 
                        picker="year" 
                        value={dayjs(selectedYear)}
                        format="YYYY년"
                        onChange={(date) => {
                            if (date) setSelectedYear(date.format('YYYY'));
                        }}
                        style={{ width: 120 }}
                    />
                    {/* ▲▲▲ ▲▲▲ ▲▲▲ */}

                    <Button icon={<ReloadOutlined />} onClick={() => fetchData(currentYYYYMM)}>조회</Button>
                    
                    <Tag color={isClosed ? 'red' : isFinalized ? 'green' : 'gold'} style={{ fontSize: 14 }}>
                        상태: {isFinalized ? '확정' : isClosed ? '마감됨' : 'OPEN'}
                    </Tag>

                    {/* SAP 업로드 버튼 */}
                    <Button 
                        icon={<UploadOutlined />} 
                        style={{ backgroundColor: '#52c41a', color: 'white', border: 'none' }}
                        onClick={() => setIsUploadModalOpen(true)}
                    >
                        SAP 실적 업로드
                    </Button>
                </Space>
            </Col>
            
            {/* ▼▼▼ [수정 4] 월 선택 버튼 그룹 ▼▼▼ */}
            <Col span={24}>
                <span style={{ fontWeight: 'bold', marginRight: 16 }}>기준 월 선택:</span>
                <Space size={[8, 8]} wrap>
                    {MONTHS_ARRAY.map(month => (
                        <Button
                            key={month}
                            type={selectedMonthIndex === month ? 'primary' : 'default'}
                            onClick={() => setSelectedMonthIndex(month)}
                            size="small"
                        >
                            {month}월
                        </Button>
                    ))}
                </Space>
            </Col>
            {/* ▲▲▲ ▲▲▲ ▲▲▲ */}
        </Row>
      </Card>
      
      {/* 실적 확정 및 통계 카드 (Previous Step) */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle" justify="space-between">
            <Col span={6}>
                <Statistic title="당월 총 계획 예산" value={totalPlan.toLocaleString()} suffix="KRW" />
            </Col>
            <Col span={6}>
                <Statistic title="당월 총 집행액" value={totalSpend.toLocaleString()} suffix="KRW" valueStyle={{ color: '#cf1322' }} />
            </Col>
            <Col span={6}>
                <Statistic title="당월 예산 소진율" value={totalBurnRate} suffix="%" valueStyle={{ color: Number(totalBurnRate) > 90 ? 'red' : '#3f8600' }} />
            </Col>
            <Col span={6} style={{ textAlign: 'right' }}>
                {isFinalized ? (
                    <Alert message="✅ 실적 확정 완료" type="success" showIcon style={{ height: '40px', justifyContent: 'center' }}/>
                ) : (
                    <Button 
                        type="primary" 
                        icon={<CheckCircleOutlined />} 
                        onClick={handleFinalize}
                        // 마감 상태이거나 집행액이 0이면 확정 방지
                        disabled={isClosed || totalSpend === 0} 
                    >
                        {currentYYYYMM} 실적 최종 확정
                    </Button>
                )}
            </Col>
        </Row>
      </Card>


      {/* 데이터 테이블 영역 */}
      <Table 
        dataSource={data} 
        columns={columns}
        rowKey="proj_id" 
        loading={loading} 
        size="small" 
        bordered
        pagination={{ pageSize: 15 }}
        scroll={{ x: 1200, y: 700 }}
      />

      {/* SAP 업로드 팝업 */}
      <SapUploadModal 
        open={isUploadModalOpen} 
        onCancel={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          fetchData(currentYYYYMM);
        }} 
      />
    </div>
  );
};

export default MonthlyInputPage;