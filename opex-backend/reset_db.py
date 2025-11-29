# reset_db.py
import sqlite3
import os

# DB 파일 경로 (현재 폴더에 있다고 가정)
DB_FILE = "opex.db"

def reset_database():
    if not os.path.exists(DB_FILE):
        print(f"❌ '{DB_FILE}' 파일이 없습니다.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 삭제할 테이블 목록 (외래키 의존성 때문에 순서가 중요할 수 있음)
    tables_to_drop = [
        "tb_monthly_data",      # 자식 테이블 (ProjectMaster 참조)
        "tb_sap_upload_raw",    # 자식 테이블
        "tb_budget_transfer",   # 자식 테이블
        "tb_project_master",    # 부모 테이블 (핵심)
        "tb_vendor_master",     # 부모 테이블
        "tb_service_master",    # 부모 테이블
        "tb_monthly_close"      # 독립 테이블
    ]

    print("🔄 테이블 삭제 중...")
    for table in tables_to_drop:
        try:
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
            print(f"   - {table} 삭제 완료")
        except Exception as e:
            print(f"   ⚠️ {table} 삭제 실패: {e}")

    conn.commit()
    conn.close()
    print("✅ 모든 테이블이 초기화되었습니다. 서버를 재시작하면 새로 생성됩니다.")

if __name__ == "__main__":
    reset_database()