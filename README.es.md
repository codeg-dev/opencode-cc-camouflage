# opencode-cc-camouflage

Un complemento de mantenimiento para OpenCode que ayuda a verificar, aplicar y revertir parches relacionados con el plugin de autenticación Anthropic. Este paquete no es un fork de proyectos upstream. Proporciona herramientas explícitas sin hooks automáticos.

## Qué es esto

`opencode-cc-camouflage` es un complemento de mantenimiento que:

- Verifica la seguridad de los parches antes de cualquier modificación
- Aplica parches al plugin peer cuando lo solicitas explícitamente
- Revierte parches cuando necesitas deshacer cambios
- Reporta el estado y proporciona orientación de diagnóstico

No aplica parches automáticamente durante la instalación. Toda mutación requiere la invocación explícita de herramientas.

## Prerrequisitos y orden de instalación

El orden de instalación importa. Debes tener lo siguiente en su lugar antes de que este plugin pueda funcionar:

1. **`not-claude-code-emulator`** (commit `5541e5c`)
   - El runtime de mensajes que proporciona interfaces compatibles con Anthropic
   - Clonar en `~/github/not-claude-code-emulator`

2. **`opencode-anthropic-auth`** (commit `6594dd1`)
   - El plugin peer que gestiona OAuth de Anthropic
   - Instalar como plugin OpenCode junto con este paquete

3. **`opencode-cc-camouflage`** (este paquete)
   - Instalar al final, después del emulador y el plugin peer

Consulta [docs/install.md](docs/install.md) para los pasos detallados.

## Herramientas disponibles

Este plugin expone cuatro herramientas explícitas. No son hooks automáticos.

### `status`

Reporta el estado actual de la instalación del peer.

```bash
bun run status
```

El formato de salida es legible por máquina:

```
peer=present
emulator=present
patch=clean
install_mode=local-folder
support=supported
```

El código de salida 0 significa saludable. El código de salida 1 significa que algo requiere atención.

### `doctor`

Proporciona orientación de diagnóstico basada en el estado actual.

```bash
bun run doctor
```

Esto inspecciona archivos y reporta próximos pasos accionables. No instala, aplica parches ni modifica nada. Solo lee y reporta.

### `patch_apply`

Aplica el parche fijado al plugin peer.

```bash
bun run patch:apply
```

Esto requiere:
- El plugin peer debe estar presente
- Las verificaciones pre-vuelo del parche deben pasar
- Una raíz peer con permisos de escritura

Crea marcadores de rollback antes de modificar archivos.

### `patch_revert`

Revierte un parche aplicado anteriormente.

```bash
bun run patch:revert
```

Usa marcadores de rollback para restaurar el estado pre-parche. Los marcadores deben coincidir con el hash del parche actual.

## Por qué los hooks automáticos son solo para verificación

Los hooks automáticos en este plugin están limitados a verificación y metadatos. No aplican parches automáticamente porque:

1. Mutar un plugin peer sin intención explícita viola el principio de menor sorpresa
2. Fallos de parche necesitan revisión humana, no reintentos silenciosos
3. El rollback requiere consentimiento explícito

Los hooks advierten cuando se detecta desviación. Tú decides si aplicar, revertir o dejar el entorno inalterado.

## Soporte de plataforma

| Plataforma | Estado | Notas |
|------------|--------|-------|
| macOS      | Soportado | Entorno de escritorio principal |
| Linux      | Soportado | Mismos fixtures upstream fijados |
| Windows    | No soportado | Sin promesa v1 |

## Rollback

Si necesitas deshacer una aplicación de parche:

```bash
bun run patch:revert
```

Consulta [docs/rollback.md](docs/rollback.md) para pasos concretos.

## Canario de compatibilidad

Para verificar desviación upstream:

```bash
bun run compat:canary
```

Esta es una verificación de solo lectura. Sale con código 0 en targets soportados.

## Documentación

- [docs/install.md](docs/install.md) - Prerrequisitos y pasos de instalación
- [docs/rollback.md](docs/rollback.md) - Pasos concretos de rollback
- [docs/compatibility.md](docs/compatibility.md) - Límites de compatibilidad
- [docs/next-release.md](docs/next-release.md) - Canario de desviación upstream
- [docs/support-matrix.md](docs/support-matrix.md) - Versiones de fixtures bloqueadas

## Desarrollo

```bash
bun install
bun run typecheck
bun run test:unit
bun run test:integration
bun run verify:patches
bun run check:publish-safety
```

## Licencia

MIT

<!-- i18n:source-hash:bbc8ec6a2d5a415af5cd25da87d0af8e98de204a7cfc69f8edb6846ce44a3404 -->
