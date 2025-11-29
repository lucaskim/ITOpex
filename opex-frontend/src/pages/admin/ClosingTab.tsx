// src/pages/admin/ClosingTab.tsx (전체 코드)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, DatePicker, Button, Tag, Space, message, Alert, List, Row, Col, Typography, Spin } from 'antd';
import dayjs from 'dayjs';
import { getClosingStatus, updateClosingStatus } from '../../api/closingApi';
import type { ClosingStatus } from '../../types'; 
import SapUploadModal from "../execution/SapUploadModal";

const { Text } = Typography;

// [변경] 날짜 포맷팅 헬퍼 함수
const formatClosedDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    // 초단위는 제거하고 년월일 시분초만 표시
    return dayjs(dateStr).format('YY-MM-DD HH:mm');
};

const get12Months = (year: dayjs.Dayjs): string[] => {
    const months: string[] = [];
    for (let i = 0; i < 12; i++) {
        months.push(year.startOf('year').add(i, 'month').format('YYYYMM'));
    }
    return months;
};

const ClosingTab: React.FC = () => {
    const [selectedYear, setSelectedYear] = useState(dayjs()); 
    const [statuses, setStatuses] = useState<ClosingStatus[]>([]); 
    const [loading, setLoading] = useState(false);

    const targetMonths = useMemo(() => get12Months(selectedYear), [selectedYear]);
    const formattedYear = selectedYear.format('YYYY');

    const fetchAllStatuses = useCallback(async (months: string[]) => {
        setLoading(true);
        try {
            const promises = months.map(yyyymm => getClosingStatus(yyyymm));
            const results = await Promise.all(promises);
            setStatuses(results);
        } catch (error) {
            message.error('마감 상태를 불러오는 중 오류가 발생했습니다.');
            setStatuses(months.map(m => ({ yyyymm: m, status: 'OPEN' }))); 
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllStatuses(targetMonths);
    }, [selectedYear, fetchAllStatuses, targetMonths]);

    const handleUpdateStatus = async (yyyymm: string, newStatus: 'OPEN' | 'CLOSED') => {
        if (window.confirm(`${dayjs(yyyymm, 'YYYYMM').format('YYYY년 MM월')}을(를) ${newStatus === 'CLOSED' ? '마감(잠금)' : '마감 해제'} 처리하시겠습니까?`)) {
            setLoading(true);
            try {
                await updateClosingStatus(yyyymm, newStatus);
                await fetchAllStatuses(targetMonths);
            } catch (error) {
                message.error(`${yyyymm} 처리 중 오류가 발생했습니다.`);
            }
        }
    };

    const handleBulkUpdate = async (newStatus: 'OPEN' | 'CLOSED') => {
        if (window.confirm(`${formattedYear}년 전체를 일괄 ${newStatus === 'CLOSED' ? '마감(잠금)' : '마감 해제'} 처리하시겠습니까?`)) {
            setLoading(true);
            try {
                const promises = statuses.map(s => updateClosingStatus(s.yyyymm, newStatus));
                await Promise.all(promises);

                message.success(`${formattedYear}년 전체가 일괄 ${newStatus === 'CLOSED' ? '마감' : '해제'}되었습니다.`);
                await fetchAllStatuses(targetMonths);
            } catch (error) {
                message.error('일괄 처리 중 일부 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        }
    };

    const isAllClosed = statuses.every(s => s.status === 'CLOSED');
    const isAllOpen = statuses.every(s => s.status === 'OPEN');

    return (
        <Card title={`월별 데이터 마감 통제 - ${formattedYear}년`} size="small" style={{ maxWidth: 900 }}>
            <Alert 
                message="데이터 거버넌스" 
                description="마감된 월의 모든 실적/계획 데이터는 수정이 불가능합니다. (통제 로직 적용됨)" 
                type="warning" 
                showIcon 
                style={{ marginBottom: 20 }}
            />
            
            <Space size="large" align="center" style={{ marginBottom: 20 }}>
                <DatePicker 
                    picker="year"
                    value={selectedYear}
                    format="YYYY년"
                    onChange={(date) => {
                        if (date) setSelectedYear(date);
                    }}
                />
                
                {/* 일괄 마감/해제 버튼 */}
                <Button 
                    type="primary" 
                    danger 
                    disabled={isAllOpen || loading}
                    onClick={() => handleBulkUpdate('OPEN')}
                >
                    연도 전체 일괄 해제
                </Button>
                <Button 
                    type="primary"
                    disabled={isAllClosed || loading}
                    onClick={() => handleBulkUpdate('CLOSED')}
                >
                    연도 전체 일괄 마감
                </Button>
            </Space>

            {/* 마감 상태 리스트 */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <Spin size="large" tip="상태 조회 중..." />
                </div>
            ) : (
                <List
                    bordered
                    size="small"
                    dataSource={statuses}
                    // ▼▼▼ 테이블 헤더 추가 (List에 헤더 역할 부여) ▼▼▼
                    header={
                        <Row style={{ fontWeight: 'bold' }}>
                            <Col span={6}>월(MONTH)</Col>
                            <Col span={4} style={{ textAlign: 'center' }}>상태</Col>
                            <Col span={8}>마감 일시</Col>
                            <Col span={6} style={{ textAlign: 'right' }}>액션</Col>
                        </Row>
                    }
                    // ▲▲▲ ▲▲▲ ▲▲▲
                    renderItem={(item) => {
                        const isClosed = item.status === 'CLOSED';
                        const tagColor = isClosed ? 'red' : 'green';
                        const monthName = dayjs(item.yyyymm, 'YYYYMM').format('MM월 (YYYY)');
                        const closedTime = formatClosedDate(item.closed_at); // 헬퍼 함수 사용

                        return (
                            // ▼▼▼ List.Item 안에 Row/Col 구조를 개선하여 컬럼화 ▼▼▼
                            <List.Item style={{ padding: '8px 16px' }}>
                                <Row justify="space-between" align="middle" style={{ width: '100%' }}>
                                    
                                    {/* 1. 월 */}
                                    <Col span={6}>
                                        <Text strong>{monthName}</Text>
                                    </Col>

                                    {/* 2. 상태 TAG */}
                                    <Col span={4} style={{ textAlign: 'center' }}>
                                        <Tag color={tagColor} style={{ fontSize: '14px' }}>
                                            {isClosed ? '🔒 마감 완료' : '✅ OPEN'}
                                        </Tag>
                                    </Col>

                                    {/* 3. 마감 일시 (개별 컬럼화) */}
                                    <Col span={8}>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {isClosed ? closedTime : '-'}
                                        </Text>
                                    </Col>

                                    {/* 4. 액션 버튼 */}
                                    <Col span={6} style={{ textAlign: 'right' }}>
                                        {isClosed ? (
                                            <Button 
                                                type="primary" 
                                                danger 
                                                size="small" 
                                                onClick={() => handleUpdateStatus(item.yyyymm, 'OPEN')}
                                            >
                                                마감 해제
                                            </Button>
                                        ) : (
                                            <Button 
                                                type="primary" 
                                                size="small" 
                                                onClick={() => handleUpdateStatus(item.yyyymm, 'CLOSED')}
                                            >
                                                마감
                                            </Button>
                                        )}
                                    </Col>
                                </Row>
                            </List.Item>
                            // ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲
                        );
                    }}
                />
            )}
        </Card>
    );
};

export default ClosingTab;