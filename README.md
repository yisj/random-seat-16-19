# 싸피 16기 서울 19반 자리배치 프로그램

랜덤 자리 배치 프로그램

## 실행 방법

```bash
npm start
```

서버가 실행되면 브라우저에서 http://localhost:3000 으로 접속합니다.

포트를 바꾸려면 `PORT` 환경 변수를 지정하세요.

```bash
PORT=4000 npm start
```

## 요구 사항

- Node.js >= 22.5.0

## 파일 구성

- `server.js` — 정적 페이지 제공 및 배치 이력 API(`/api/history`) 서버
- `index.html` — 자리 배치 화면
- `students.txt` — 학생 명단
- `seats.txt` — 자리 배치 정보(문/스크린 위치, 결석 자리 등)
- `data/seating.db` — 배치 이력 파일
