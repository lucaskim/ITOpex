# app/core/logging_setup.py
import logging.config
import sys

LOGGING_CONFIG = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'default': {
            # ▼▼▼ [수정됨] 로그 레벨, 시간, 모듈 이름, 메시지 포맷 지정 ▼▼▼
            'fmt': '[%(levelname)s] %(asctime)s | %(name)s | %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S', # 시간 포맷 지정
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'default',
            'stream': sys.stdout,
        },
    },
    # ▼▼▼ [수정된 부분] 로거 설정 추가 - Uvicorn 접근 로그를 재정의합니다. ▼▼▼
    'loggers': {
        'root': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'uvicorn.access': { # Uvicorn의 Access Logger 이름
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False, # 상위 로거(root)로 전파되는 것을 막음
        },
    }
    # ▲▲▲ ▲▲▲ ▲▲▲
}

def setup_logging():
    """로깅 설정을 적용합니다."""
    logging.config.dictConfig(LOGGING_CONFIG)