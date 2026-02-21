# Mnemo SecondBrain - Obsidian Plugin

Obsidian 볼트에서 Mnemo 지식 그래프를 검색하고 탐색하는 플러그인.

## Features

- **Hybrid Search** (Ctrl+Shift+M): keyword + vector + graph 통합 검색
- **Graph View**: 지식 그래프 시각화 (개발 중)
- **Server Status**: Mnemo 서버 상태 확인

## Installation

### Manual Install
1. `obsidian-plugin/` 폴더에서 빌드:
   ```bash
   npm install
   npm run build
   ```
2. `main.js`, `manifest.json`, `styles.css`를 볼트의 `.obsidian/plugins/mnemo-secondbrain/`에 복사
3. Obsidian → Settings → Community plugins → Mnemo SecondBrain 활성화

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| API URL | `http://127.0.0.1:8000` | Mnemo FastAPI 서버 주소 |
| Search limit | 10 | 검색 결과 최대 개수 |
| Search mode | hybrid | hybrid / vector / keyword / graph |

## Usage

1. Mnemo 서버 실행: `cd C:\TEST\MAISECONDBRAIN && python -m uvicorn src.api:app`
2. Obsidian에서 `Ctrl+Shift+M` → 검색어 입력
3. 결과 선택 → 해당 노트 열기

## Requirements

- Mnemo FastAPI 서버 실행 중
- Obsidian 1.0.0+

## Screenshots

<!-- TODO: 스크린샷 추가 -->
