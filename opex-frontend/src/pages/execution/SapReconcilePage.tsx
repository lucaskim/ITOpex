import React, { useEffect, useState } from 'react';
// 1. Alert 추가, Tag 제거
import { Table, Card, Button, Select, message, Row, Col, Statistic, Alert } from 'antd';
import { SwapOutlined, ReloadOutlined } from '@ant-design/icons';
import { getUnmappedSapData, manualMapSapData } from '../../api/sapApi';
import { getProjects } from '../../api/projectApi';

const SapReconcilePage: React.FC = () => {
  const [unmappedData, setUnmappedData] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [targetProjId, setTargetProjId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const initData = async () => {
    setLoading(true);
    try {
      const [uData, pData] = await Promise.all([
        getUnmappedSapData(),
        getProjects()
      ]);
      setUnmappedData(uData);
      setProjects(pData);
      setSelectedRowKeys([]);
    } catch (err) {
      message.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { initData(); }, []);

  const handleMap = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('매핑할 전표를 선택해주세요.');
      return;
    }
    if (!targetProjId) {
      message.warning('연결할 사업을 선택해주세요.');
      return;
    }

    try {
      await manualMapSapData(selectedRowKeys as number[], targetProjId);
      message.success('매핑되었습니다.');
      initData(); // 재조회
    } catch (err) {
      message.error('매핑 실패');
    }
  };

  const columns = [
    { title: '전기일', dataIndex: 'yyyymm', width: 80 },
    { title: '전표번호', dataIndex: 'slip_no', width: 100 },
    { title: '텍스트', dataIndex: 'header_text', ellipsis: true },
    { title: '업체명', dataIndex: 'vendor_text', width: 120 },
    { 
      title: '금액', 
      dataIndex: 'amt_val', 
      width: 100, 
      align: 'right' as const,
      render: (v:number) => v.toLocaleString() 
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <h3>🔍 SAP 미매핑 전표 대사 (Reconciliation)</h3>
      
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={16}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>미매핑 전표 목록 ({unmappedData.length}건)</span>
                <Button icon={<ReloadOutlined />} size="small" onClick={initData}>새로고침</Button>
              </div>
            }
          >
            <Table 
              dataSource={unmappedData} 
              columns={columns} 
              rowKey="raw_id"
              size="small"
              // 2. loading 속성 연결 (이제 에러 안 남)
              loading={loading}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
              pagination={{ pageSize: 10 }}
              scroll={{ y: 400 }}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card title="매핑 대상 사업 선택" style={{ height: '100%' }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Statistic title="선택된 전표 수" value={selectedRowKeys.length} />
              <div style={{ margin: '20px 0' }}>⬇️ 연결할 사업 ⬇️</div>
              
              <Select 
                style={{ width: '100%', marginBottom: 20 }}
                placeholder="사업을 선택하세요 (검색 가능)"
                showSearch
                optionFilterProp="label"
                onChange={(val) => setTargetProjId(val)}
                options={projects.map(p => ({
                  value: p.proj_id,
                  label: `[${p.proj_id}] ${p.proj_name}`
                }))}
              />

              <Button 
                type="primary" 
                icon={<SwapOutlined />} 
                size="large" 
                block 
                onClick={handleMap}
                disabled={selectedRowKeys.length === 0 || !targetProjId}
              >
                선택한 전표 매핑하기
              </Button>
            </div>
            
            {/* 3. Alert 컴포넌트 사용 */}
            <Alert 
              message="Tip" 
              description="자동 매핑되지 않은 전표들을 선택하여 올바른 사업 예산으로 연결해 주세요." 
              type="info" 
              showIcon 
              style={{ marginTop: 20 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SapReconcilePage;