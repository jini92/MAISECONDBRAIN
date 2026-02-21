# Obsidian Community Plugin 등록 가이드

## 사전 준비 완료 항목

- [x] `manifest.json` — id, name, version, minAppVersion, description, author, authorUrl, isDesktopOnly
- [x] `versions.json` — 버전 → 최소 Obsidian 버전 매핑
- [x] `main.js` — 빌드된 플러그인
- [x] `styles.css` — 스타일
- [x] `README.md` — 기능/설치/설정 문서
- [x] `LICENSE` — MIT

## Step 1: GitHub Release 생성

```powershell
cd C:\TEST\MAISECONDBRAIN\obsidian-plugin
gh release create v0.1.0 main.js manifest.json styles.css --title "v0.1.0" --notes "Initial release of Mnemo SecondBrain Obsidian plugin" --repo jini92/MAISECONDBRAIN
```

릴리즈에 포함할 파일 (3개):
- `main.js`
- `manifest.json`
- `styles.css`

## Step 2: obsidian-releases 레포에 PR 제출

1. **Fork**: https://github.com/obsidianmd/obsidian-releases
2. **`community-plugins.json` 편집** — 배열 끝에 추가:

```json
{
  "id": "mnemo-secondbrain",
  "name": "Mnemo SecondBrain",
  "author": "jini92",
  "description": "Personal knowledge graph with hybrid search (keyword + vector + graph) for your Obsidian vault.",
  "repo": "jini92/MAISECONDBRAIN"
}
```

3. **PR 제출** — 타이틀: `Add plugin: Mnemo SecondBrain`
4. **리뷰 대기** — Obsidian 팀이 코드 리뷰 진행

## 리뷰어 체크리스트

Obsidian 팀이 확인하는 주요 항목:

| 항목 | 상태 |
|------|------|
| `eval()` 미사용 | ✅ |
| 불필요한 네트워크 요청 없음 | ✅ (사용자 설정 API 서버만 호출) |
| 사용자 데이터 외부 전송 없음 | ✅ |
| 에러 핸들링 | ✅ |
| 개인정보 없음 | ✅ |
| manifest.json 필수 필드 | ✅ |
| GitHub Release 존재 | ⬜ (생성 필요) |

## 참고 링크

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)
- [obsidian-releases repo](https://github.com/obsidianmd/obsidian-releases)
- [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)

## 주의사항

- `isDesktopOnly: false`로 설정되어 있으나, Mnemo API 서버가 필요하므로 모바일에서는 로컬 서버 접근이 제한될 수 있음
- README에 API 서버 요구사항 명시 완료
