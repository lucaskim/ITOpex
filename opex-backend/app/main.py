# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1 import vendors, services, projects, execution, sap, report, utils, accounts
from app.api.v1 import sap as sap_api
from app.api.v1 import closing as closing_api # <--- API 라우터를 closing_api로 임포트!
from app.models import vendor, service, project, sap, transfer, account   # (테이블 생성용)
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

# app/main.py (validation_exception_handler 함수 내부 수정)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    
    # 1. Pydantic 에러 상세 정보 가져오기
    error_details = exc.errors()

    # 2. 로깅 (기존 코드 유지)
    print("\n=============================================")
    print("🚨 FATAL VALIDATION ERROR (422) TRACE:")
    
    # 3. JSON 직렬화 가능하도록 에러 객체 정리 (핵심 수정)
    # NOTE: Pydantic errors() 리스트를 순회하며 JSON 호환 형태로 만듭니다.
    json_compatible_errors = []
    for error in error_details:
        print(f"  [FIELD REQUIRED/TYPE ERROR] Path: {' -> '.join(map(str, error['loc']))}")
        print(f"  Message: {error['msg']}")
        print(f"  Input received: {error['input']}")
        
        # JSON 직렬화 가능하도록 정리 (ValueError를 제거)
        json_compatible_errors.append({
            "type": error['type'],
            "loc": error['loc'],
            "msg": error['msg'],
            # 'input' 필드는 복잡하므로 여기서는 제외하거나 문자열로 처리하는 것이 안전함.
            # 하지만, error['input']에는 문제 필드도 들어있으므로, JSON 직렬화가 가능한 부분만 포함시킵니다.
        })
        
    print("---------------------------------------------")

    # 4. JSONResponse를 정리된 데이터로 반환
    return JSONResponse(
        status_code=422,
        content={"detail": json_compatible_errors}, # 직렬화 가능 객체 사용
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
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["Accounts & Codes"])