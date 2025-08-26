# Llama Chat AI - 웹서버 채팅 AI

Node.js와 `node-llama-cpp`를 사용한 로컬 AI 채팅 서버입니다.

## 🚀 기능

- **로컬 AI 모델**: Llama 모델을 로컬에서 실행
- **실시간 채팅**: WebSocket을 통한 실시간 대화
- **스트리밍 응답**: AI 응답을 실시간으로 스트리밍
- **세션 관리**: 개별 사용자 세션 관리
- **반응형 웹 UI**: 모바일 친화적인 채팅 인터페이스
- **자동 재연결**: 연결 끊김 시 자동 재연결

## 📦 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

새로 추가된 의존성:
- `express`: 웹서버
- `ws`: WebSocket 서버
- `uuid`: 고유 ID 생성
- 관련 TypeScript 타입 정의들

### 2. AI 모델 다운로드

```bash
npm run models:pull
```

이 명령어는 GPT-OSS-20B 모델을 자동으로 다운로드합니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

또는 일반 실행:

```bash
npm start
```

### 4. 프로덕션 빌드

```bash
npm run build
npm run start:build
```

## 🌐 사용법

1. 서버 실행 후 브라우저에서 `http://localhost:3000` 접속
2. AI 시스템이 초기화될 때까지 잠시 대기
3. "AI 시스템이 준비되었습니다!" 메시지 확인 후 채팅 시작

## 🏗️ 프로젝트 구조

```
├── src/
│   ├── services/
│   │   ├── aiService.ts      # AI 모델 관리 서비스
│   │   └── websocketHandler.ts # WebSocket 연결 관리
│   └── server.ts             # 메인 서버
├── public/
│   └── index.html           # 채팅 웹 인터페이스
├── models/                  # AI 모델 파일 (자동 생성)
└── dist/                   # 빌드된 파일
```

## 🔧 API 엔드포인트

### HTTP API

- `GET /` - 채팅 웹 인터페이스
- `GET /api/status` - 서버 상태 확인
- `GET /api/health` - 헬스체크

### WebSocket API

WebSocket 서버는 HTTP 포트 + 1에서 실행됩니다 (기본값: 3001).

#### 메시지 형식

**클라이언트 → 서버:**
```json
{
  "type": "message|ping|session_create|session_delete",
  "sessionId": "uuid",
  "content": "사용자 메시지",
  "timestamp": "ISO 시간"
}
```

**서버 → 클라이언트:**
```json
{
  "type": "message|chunk|error|session_created|pong|status",
  "sessionId": "uuid",
  "content": "AI 응답",
  "error": "오류 메시지",
  "timestamp": "ISO 시간",
  "isComplete": true
}
```

## ⚙️ 설정

### 환경 변수

- `PORT`: HTTP 서버 포트 (기본값: 3000)
- WebSocket 포트는 자동으로 HTTP 포트 + 1로 설정됩니다

### 모델 설정

`src/services/aiService.ts`에서 다음을 수정할 수 있습니다:

- 모델 경로
- 컨텍스트 크기
- 세션 정리 간격

```typescript
const modelPath = await resolveModelFile(
    "hf:giladgd/gpt-oss-20b-GGUF/gpt-oss-20b.MXFP4.gguf",
    modelsDirectory
);

const context = await this.model.createContext({
    contextSize: { max: 8096 } // 컨텍스트 크기 조정
});
```

## 🔍 모니터링

### 서버 상태 확인

```bash
curl http://localhost:3000/api/status
```

응답:
```json
{
  "status": "running",
  "aiServiceReady": true,
  "activeSessions": 2,
  "activeConnections": 1,
  "websocketPort": 3001,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 로그 확인

서버는 다음과 같은 컬러 로그를 출력합니다:

- 🟡 노란색: 초기화 및 일반 정보
- 🟢 초록색: 성공 메시지
- 🔵 파란색: WebSocket 연결 정보
- 🔴 빨간색: 오류 메시지

## 🚨 문제 해결

### 모델 다운로드 실패

```bash
# 수동으로 모델 다운로드
npm run models:pull

# 또는 캐시 삭제 후 재시도
npm run clean
npm install
```

### 메모리 부족

큰 모델의 경우 충분한 RAM이 필요합니다:

- 최소 8GB RAM 권장
- 컨텍스트 크기를 줄여보세요: `contextSize: { max: 4096 }`

### 연결 문제

- 방화벽에서 포트 3000, 3001 허용 확인
- 다른 애플리케이션이 포트를 사용하고 있는지 확인

## 🔄 업데이트

기존 프로젝트를 업데이트하려면:

1. 새로운 `package.json` 의존성 추가
2. `src/` 디렉토리 생성 및 파일들 추가
3. `public/index.html` 생성
4. `npm install` 실행

## 📝 라이선스

이 프로젝트는 원본 `node-llama-cpp` 템플릿의 라이선스를 따릅니다.

## 🤝 기여

버그 리포트나 기능 제안은 언제나 환영합니다!