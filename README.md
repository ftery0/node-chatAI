# Llama Chat AI - 분리된 서버 구조

AI 서버와 API 서버가 `src` 폴더 내에서 분리된 구조입니다.

## 프로젝트 구조

```
├── src/
│   ├── api/            # 오라클 클라우드용 API 서버
│   │   ├── db/         # MongoDB 모델, 연결
│   │   ├── types/      # TypeScript 타입 정의
│   │   └── server.ts   # API 서버 엔트리
│   └── ai/             # 나노보드용 AI 서버
│       ├── services/   # AI 서비스, WebSocket 핸들러
│       └── aiServer.ts # AI 서버 엔트리
├── public/             # 프론트엔드 파일들
├── models/             # Llama 모델 파일들
└── package.json        # 루트 관리 스크립트
```

## 설치 및 실행

### 설치
```bash
npm install
```

### 개발 모드 (두 서버 동시 실행)
```bash
npm run dev
```

### 개별 서버 실행
```bash
# API 서버만
npm run dev:api

# AI 서버만
npm run dev:ai
```

### 빌드
```bash
# 전체 빌드
npm run build

# 개별 빌드
npm run build:api
npm run build:ai
```

### 프로덕션 실행
```bash
# API 서버 (오라클 클라우드)
npm run start:api

# AI 서버 (나노보드)
npm run start:ai
```

## 배포

### API 서버 (오라클 클라우드)
```bash
npm run build:api
# dist/api/, public/, package.json, node_modules/ 배포
```

### AI 서버 (나노보드)
```bash
npm run models:pull  # 모델 다운로드
npm run build:ai
# dist/ai/, models/, package.json, node_modules/ 배포
```

## 환경변수

### API 서버
- `PORT`: HTTP 포트 (기본: 3000)
- `MONGODB_URI`: MongoDB 연결 URI
- `SESSION_SECRET`: 세션 시크릿
- `AI_WS_PORT`: AI 서버 WebSocket 포트 (기본: 3001)

### AI 서버
- `AI_WS_PORT`: WebSocket 포트 (기본: 3001)

## 포트 구성

- API 서버: `http://localhost:3000`
- AI 서버: `ws://localhost:3001`
- 프론트엔드: API 서버를 통해 제공