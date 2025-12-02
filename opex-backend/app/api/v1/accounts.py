from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.account import GLAccountMaster, BudgetCodeMaster, CostCenterMaster
from app.schemas.account import (
    GLAccount, GLAccountCreate, 
    BudgetCode, BudgetCodeCreate,
    CostCenter, CostCenterCreate, BudgetCodeUpdatePayload
)

router = APIRouter()

# --- G/L Account APIs ---
@router.get("/gl", response_model=List[GLAccount])
def read_gl_accounts(db: Session = Depends(get_db)):
    return db.query(GLAccountMaster).filter(GLAccountMaster.is_active == 'Y').all()

@router.post("/gl", response_model=GLAccount)
def create_gl_account(item: GLAccountCreate, db: Session = Depends(get_db)):
    db_item = db.query(GLAccountMaster).filter(GLAccountMaster.gl_account_code == item.gl_account_code).first()
    if db_item:
        raise HTTPException(status_code=400, detail="이미 존재하는 G/L 코드입니다.")
    
    new_item = GLAccountMaster(**item.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

# --- Budget Code APIs ---
@router.get("/budget-code", response_model=List[BudgetCode])
def read_budget_codes(code_type: str = None, db: Session = Depends(get_db)):
    query = db.query(BudgetCodeMaster).filter(BudgetCodeMaster.is_active == 'Y')
    if code_type:
        query = query.filter(BudgetCodeMaster.code_type == code_type)
    return query.order_by(BudgetCodeMaster.sort_order).all()


# BudgetCodeType에 따른 다음 코드 ID를 생성하는 헬퍼 함수
def get_next_code_id(db: Session, code_type: str) -> str:
    """주어진 code_type에 기반하여 다음 순번의 code_id를 생성합니다."""
    
    # 해당 code_type의 가장 큰 code_id를 조회
    # 예: code_type이 'BUDGET_L1'일 경우, 'BUDGET_L1_XXX' 형태에서 가장 큰 값을 찾습니다.
    latest_code = db.query(BudgetCodeMaster).filter(
        BudgetCodeMaster.code_type == code_type
    ).order_by(
        BudgetCodeMaster.code_id.desc()
    ).first()

    prefix = code_type.upper()
    
    if latest_code:
        # 기존 ID에서 숫자 부분 추출 후 +1
        try:
            # 예: 'BUDGET_L1_005' -> 005 -> 6
            last_num = int(latest_code.code_id.split('_')[-1])
            next_num = last_num + 1
        except ValueError:
            # 파싱 실패 시 기본값 1
            next_num = 1
    else:
        # 해당 type의 첫 번째 항목
        next_num = 1
        
    # 새로운 ID 포맷: [TYPE]_[001]
    # L1, L2, IT_TYPE 모두 동일한 포맷을 사용합니다.
    return f"{prefix}_{next_num:03d}"



@router.post("/budget-code", response_model=BudgetCode)
def create_budget_code(item: BudgetCodeCreate, db: Session = Depends(get_db)):
   # [수정] code_id 참조 대신 자동 채번 로직 호출
    new_code_id = get_next_code_id(db, item.code_type)
    
    # 겹치는 ID가 없는지 (사실상 get_next_code_id로 보장되지만 방어 코드)
    # db_item = db.query(BudgetCodeMaster).filter(BudgetCodeMaster.code_id == new_code_id).first()
    # if db_item:
    #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Code ID '{new_code_id}' already exists.")

    # ORM 모델 생성
    db_budget_code = BudgetCodeMaster(
        code_id=new_code_id,
        code_name=item.name, # BudgetCodeCreate의 name을 code_name에 매핑
        parent_code_id=item.parent_code_id,
        code_type=item.code_type,
        is_active='Y' if item.is_active else 'N', # boolean을 CHAR(1)로 변환
        sort_order=0 # 기본값 설정
        # description은 ORM 모델에 없으므로 매핑에서 제외
    )
    
    
    db.add(db_budget_code)
    db.commit()
    db.refresh(db_budget_code)
    return db_budget_code

# --- [신규] Cost Center APIs ---
@router.get("/cost-center", response_model=List[CostCenter])
def read_cost_centers(db: Session = Depends(get_db)):
    return db.query(CostCenterMaster).filter(CostCenterMaster.is_active == 'Y').order_by(CostCenterMaster.cc_code).all()

@router.post("/cost-center", response_model=CostCenter)
def create_cost_center(item: CostCenterCreate, db: Session = Depends(get_db)):
    db_item = db.query(CostCenterMaster).filter(CostCenterMaster.cc_code == item.cc_code).first()
    if db_item:
        raise HTTPException(status_code=400, detail="이미 존재하는 코스트 센터입니다.")
    
    new_item = CostCenterMaster(**item.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item




# 3. 예산 분류 코드 수정 (PATCH)
@router.patch("/budget-code/{code_id}", response_model=BudgetCode)
def update_budget_code(
    code_id: str, 
    item: BudgetCodeUpdatePayload, 
    db: Session = Depends(get_db)
):
    db_item = db.query(BudgetCodeMaster).filter(BudgetCodeMaster.code_id == code_id).first()
    
    if db_item is None:
        raise HTTPException(status_code=404, detail="Budget Code not found")

    # Pydantic 모델의 변경된 필드만 추출 (exclude_unset=True)
    update_data = item.model_dump(exclude_unset=True) 

    if 'name' in update_data:
        db_item.code_name = update_data['name'] # 프론트엔드의 name을 ORM의 code_name에 반영
    
    if 'is_active' in update_data:
        # boolean을 DB의 CHAR(1) ('Y'/'N')로 변환하여 저장
        db_item.is_active = 'Y' if update_data['is_active'] else 'N'
        
    if 'parent_code_id' in update_data:
        db_item.parent_code_id = update_data['parent_code_id']

    db.commit()
    db.refresh(db_item)
    return db_item


# 4. 예산 분류 코드 삭제 (DELETE)
@router.delete("/budget-code/{code_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget_code(code_id: str, db: Session = Depends(get_db)):
    db_item = db.query(BudgetCodeMaster).filter(BudgetCodeMaster.code_id == code_id).first()
    
    if db_item is None:
        raise HTTPException(status_code=404, detail="Budget Code not found")

    # L1 코드 삭제 시 하위 L2 코드가 있는지 확인하는 로직
    if db_item.code_type == 'BUDGET_L1':
        has_children = db.query(BudgetCodeMaster).filter(
            BudgetCodeMaster.parent_code_id == code_id
        ).first()
        
        if has_children:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"L1 코드 '{code_id}'는 하위 L2 코드를 가지고 있어 삭제할 수 없습니다. 하위 코드를 먼저 삭제하거나 수정하세요."
            )

    db.delete(db_item)
    db.commit()
    return