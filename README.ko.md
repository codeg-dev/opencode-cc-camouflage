# opencode-cc-camouflage

OpenCode의 동반 유지보수 플러그인으로, Anthropic 인증 플러그인 관련 패치를 검증, 적용, 되돌리는 것을 도와줍니다. 이 패키지는 업스트림 프로젝트의 포크가 아닙니다. 자동 훅 없이 명시적인 도구를 제공합니다.

## 이것이 무엇인지

`opencode-cc-camouflage`는 다음 기능을 제공하는 유지보수 플러그인입니다:

- 어떤 수정이 있기 전에 패치 안전성을 검증합니다
- 명시적으로 요청할 때 피어 플러그인에 패치를 적용합니다
- 롤백이 필요할 때 패치를 되돌립니다
- 상태를 보고하고 진단 안내를 제공합니다

설치 시 자동으로 패치하지 않습니다. 모든 변경은 명시적인 도구 호출이 필요합니다.

## 전제 조건 및 설치 순서

설치 순서가 중요합니다. 이 플러그인이 작동하려면 다음이 먼저 준비되어 있어야 합니다:

1. **`not-claude-code-emulator`** (커밋 `5541e5c`)
   - Anthropic 호환 인터페이스를 제공하는 메시지 런타임
   - `~/github/not-claude-code-emulator`에 클론

2. **`opencode-anthropic-auth`** (커밋 `6594dd1`)
   - Anthropic OAuth를 처리하는 피어 플러그인
   - 이 패키지와 함께 OpenCode 플러그인으로 설치

3. **`opencode-cc-camouflage`** (이 패키지)
   - 에뮬레이터와 피어 플러그인이 준비된 후 마지막에 설치

자세한 단계는 [docs/install.md](docs/install.md)를 참조하세요.

## 사용 가능한 도구

이 플러그인은 네 가지 명시적인 도구를 제공합니다. 자동 훅은 아닙니다.

### `status`

피어 설치의 현재 상태를 보고합니다.

```bash
bun run status
```

출력 형식은 기계가 읽을 수 있습니다:

```
peer=present
emulator=present
patch=clean
install_mode=local-folder
support=supported
```

종료 코드 0은 정상을 의미합니다. 종료 코드 1은 주의가 필요함을 의미합니다.

### `doctor`

현재 상태에 기반한 진단 안내를 제공합니다.

```bash
bun run doctor
```

이것은 파일을 검사하고 실행 가능한 다음 단계를 보고합니다. 설치, 패치 또는 수정은 하지 않습니다. 읽기와 보고만 수행합니다.

### `patch_apply`

피어 플러그인에 고정된 패치를 적용합니다.

```bash
bun run patch:apply
```

이것은 다음을 필요로 합니다:
- 피어 플러그인이 존재해야 함
- 패치 사전 점검이 통과해야 함
- 쓰기 가능한 피어 루트

파일을 수정하기 전에 롤백 마커를 생성합니다.

### `patch_revert`

이전에 적용된 패치를 되돌립니다.

```bash
bun run patch:revert
```

이것은 롤백 마커를 사용하여 패치 전 상태를 복원합니다. 되돌리기가 진행되려면 마커가 현재 패치 해시와 일치해야 합니다.

## 자동 훅이 검증 전용인 이유

이 플러그인의 자동 훅(`command.execute.before`, `tool.execute.after`)은 검증과 메타데이터로만 제한됩니다. 패치를 자동으로 적용하지 않는 이유는:

1. 명시적인 사용자 의도 없이 피어 플러그인을 변경하는 것은 최소 놀라기 원칙을 위반합니다
2. 패치 실패는 인간 검토가 필요하며, 자동 재시도는 안 됩니다
3. 롤백은 상태를 복원하기 위한 명시적 동의가 필요합니다

훅은 드리프트가 감지될 때 경고합니다. 적용할지, 되돌릴지, 환경을 변경하지 않을지는 사용자가 결정합니다.

## 플랫폼 지원

| 플랫폼 | 상태 | 참고 |
|----------|--------|-------|
| macOS    | 지원됨 | 주요 데스크톱 환경 |
| Linux    | 지원됨 | 동일한 고정 업스트림 픽스처 |
| Windows  | 지원되지 않음 | v1 약속 없음 |

고정된 픽스처 버전은 [docs/support-matrix.md](docs/support-matrix.md)를 참조하세요.

## 롤백

패치 적용을 취소해야 하는 경우:

```bash
bun run patch:revert
```

구체적인 단계와 문제 해결은 [docs/rollback.md](docs/rollback.md)를 참조하세요.

## 호환성 카나리

고정된 대상에 대한 업스트림 드리프트를 확인하려면:

```bash
bun run compat:canary
```

이것은 읽기 전용 검사로, 어떤 것도 수정하지 않고 픽스처 무결성과 업스트림 참조를 검증합니다. 고정된 지원 대상에서 종료 코드 0을 반환합니다.

카나리 워크플로우에 대한 자세한 내용은 [docs/next-release.md](docs/next-release.md)를 참조하세요.

## 문서

- [docs/install.md](docs/install.md) - 전제 조건 및 설치 단계
- [docs/rollback.md](docs/rollback.md) - 구체적인 롤백 단계
- [docs/compatibility.md](docs/compatibility.md) - 호환성 경계
- [docs/next-release.md](docs/next-release.md) - 업스트림 드리프트 카나리
- [docs/support-matrix.md](docs/support-matrix.md) - 고정된 픽스처 버전
- [docs/non-goals.md](docs/non-goals.md) - 명시적인 범위 외 항목
- [docs/patch-inventory.md](docs/patch-inventory.md) - 패치 자산 분류
- [docs/upstream-locks.md](docs/upstream-locks.md) - 개발 픽스처 참조

## 개발

```bash
# 의존성 설치
bun install

# 타입 검사
bun run typecheck

# 테스트 실행
bun run test:unit
bun run test:integration

# 픽스처에 대해 패치 검증
bun run verify:patches

# 게시 안전성 확인
bun run check:publish-safety
```

## 라이선스

MIT
