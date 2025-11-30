# app/core/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# 1. 엔진 생성 (SQLite 전용 옵션 추가)
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    connect_args={"check_same_thread": False}  # <-- SQLite 필수 옵션!
)

# 2. 세션 관리자
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. 모델 베이스
Base = declarative_base()

# 4. DB 세션 의존성 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()