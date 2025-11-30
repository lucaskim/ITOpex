# app/api/v1/utils.py
from fastapi import APIRouter
from datetime import datetime
from typing import List

router = APIRouter()

# 관리 시작 연도 정의 (사용자 요청: 2022년)
MIN_MANAGEMENT_YEAR = 2022

@router.get("/years", response_model=List[int])
def get_available_years() -> List[int]:
    """
    관리 가능한 연도 리스트를 반환합니다. (2022년 ~ 현재 연도 + 2년)
    """
    current_year = datetime.now().year
    
    # 2년 후까지 계획을 짤 수 있도록 허용
    max_year = current_year + 2 
    
    return list(range(MIN_MANAGEMENT_YEAR, max_year + 1))