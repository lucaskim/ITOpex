# app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "IT Opex System"
    API_V1_STR: str = "/api/v1"
    
    # SQLite URL
    DATABASE_URL: str

    # SQLAlchemy 접속 주소 (SQLite는 그대로 사용)
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return self.DATABASE_URL

    class Config:
        env_file = ".env"
        # .env 파일 인코딩 문제 방지
        env_file_encoding = 'utf-8'

settings = Settings()