# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import vendors, services, projects, execution, sap, report, utils
from app.api.v1 import sap as sap_api
from app.api.v1 import closing as closing_api # <--- API 라우터를 closing_api로 임포트!
from app.models import vendor, service, project, sap, transfer   # (테이블 생성용)
from logging.config import dictConfig # logging용
from app.core.logging_setup import setup_logging # logging용
from fastapi.exceptions import RequestValidationError 
#from fastapi.exception_handlers import request_validation_error_handler
from starlette.requests import Request
from fastapi.responses import JSONResponse

import logging




setup_logging()

logger = logging.getLogger("uvicorn.error")


# DB 테이블 자동 생성
Base.metadata.create_all(bind=engine)


app = FastAPI(title=settings.PROJECT_NAME)

# ▼▼▼ 2. CORS 미들웨어 설정 추가 (여기부터) ▼▼▼
origins = [
    "http://localhost:5173",      # Vite 기본 포트
    "http://127.0.0.1:5173",      # IP 접속 대비
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # 허용할 프론트엔드 주소
    allow_credentials=True,
    allow_methods=["*"],          # 모든 HTTP Method 허용 (GET, POST 등)
    allow_headers=["*"],          # 모든 Header 허용
)
# ▲▲▲ (여기까지) ▲▲▲

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Pydantic 유효성 검사 오류 발생 시 상세 내용을 터미널에 print로 기록합니다."""
    
    error_details = exc.errors()
    
    # ▼▼▼ [핵심 수정] logger 대신 print()로 강제 출력 ▼▼▼
    print("\n=============================================")
    print("🚨 FATAL VALIDATION ERROR (422) TRACE:")
    print("=============================================")

    for error in error_details:
        field_path = ' -> '.join(map(str, error['loc']))
        print(f"  [FIELD REQUIRED] Path: {field_path}")
        print(f"  Message: {error['msg']}")
        print(f"  Input: {error['input']}")
    
    print("---------------------------------------------")
    # ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲

    # 422 응답 반환 로직 (이전과 동일)
    return JSONResponse(
        status_code=422,
        content={"detail": error_details},
    )



# 헬스 체크
@app.get("/")
def health_check():
    return {"status": "ok", "message": "IT Opex Backend (SQLite) is Running!"}

# 라우터 등록
app.include_router(vendors.router, prefix="/api/v1/vendors", tags=["Vendors"])
app.include_router(services.router, prefix="/api/v1/services", tags=["Services"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["Projects"])
app.include_router(execution.router, prefix="/api/v1/execution", tags=["Execution"])
app.include_router(sap_api.router, prefix="/api/v1/sap", tags=["SAP"])
app.include_router(report.router, prefix="/api/v1/report", tags=["Report"])
app.include_router(utils.router, prefix="/api/v1/utils", tags=["Utilities"])
app.include_router(closing_api.router, prefix="/api/v1/closing", tags=["Closing"]) # <--- closing 라우터 등록 