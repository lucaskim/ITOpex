// src/pages/execution/SapUploadModal.tsx
import React, { useState } from 'react';
import { Modal, Upload, Button, message, Alert } from 'antd';
import { InboxOutlined } from '@ant-design/icons'; // 아이콘 변경
import { fileClient } from '../../api/client';
import { runAutoMapping } from '../../api/sapApi';

const { Dragger } = Upload; // Drag & Drop 전용 컴포넌트

interface Props {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const SapUploadModal: React.FC<Props> = ({ open, onCancel, onSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('파일을 선택해주세요.');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileList[0]);

    setUploading(true);
    try {
      const res = await fileClient.post('/sap/upload', formData);
      message.success(res.data.message);
      setFileList([]);
      onSuccess(); // 성공 알림
    } catch (error: any) {
      message.error('업로드 실패: ' + (error.response?.data?.detail || '서버 오류'));
    } finally {
      setUploading(false);
    }



    setUploading(true);
        try {
        // 1. 업로드 실행
        const res = await fileClient.post('/sap/upload', formData);
        message.success(res.data.message);
        
        // 2. ★ 자동 매핑 실행 (연달아 호출)
        message.loading('자동 매핑 분석 중...', 1);
        const mapRes = await runAutoMapping();
        message.success(mapRes.message); // "N건 매핑 완료"

        setFileList([]);
        onSuccess(); 
        } catch (error: any) {
        // ...
        } finally {
        setUploading(false);
        }


  };

  // Dragger 설정
  const uploadProps = {
    name: 'file',
    multiple: false, // 한 번에 1개만
    fileList,
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file: any) => {
      // 엑셀 파일인지 체크 (선택사항)
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isExcel) {
        message.error('엑셀 파일만 업로드할 수 있습니다!');
        return Upload.LIST_IGNORE;
      }
      setFileList([file]); // 파일 1개만 유지
      return false; // 자동 업로드 방지
    },
    onDrop(e: any) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  return (
    <Modal
      title="SAP 실적 엑셀 업로드"
      open={open}
      onCancel={onCancel}
      width={600} // 가로 폭을 조금 넓힘
      footer={[
        <Button key="back" onClick={onCancel}>
          취소
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={uploading}
          onClick={handleUpload}
          disabled={fileList.length === 0}
        >
          업로드 실행
        </Button>,
      ]}
    >
      <Alert
        message="업로드 가이드"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>SAP에서 다운로드 받은 <strong>FBL3N 엑셀 원본</strong>을 사용하세요.</li>
            <li><strong>'전표 번호', '금액(현지 통화)'</strong> 컬럼은 필수입니다.</li>
            <li>파일은 한 번에 1개만 업로드 가능합니다.</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <div style={{ height: 200 }}>
        <Dragger {...uploadProps} style={{ padding: '20px 0' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#1677ff' }} />
          </p>
          <p className="ant-upload-text">
            파일을 클릭하거나 이 영역으로 <strong>드래그</strong>하세요
          </p>
          <p className="ant-upload-hint">
            단일 엑셀 파일(.xlsx, .xls)만 지원됩니다.
          </p>
        </Dragger>
      </div>
    </Modal>
  );
};

export default SapUploadModal;