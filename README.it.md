# opencode-cc-camouflage

Un plugin di manutenzione complementare per OpenCode che aiuta a verificare, applicare e annullare
patch relative al plugin di autenticazione Anthropic. Questo pacchetto non e un fork di
progetti upstream. Fornisce strumenti espliciti senza hook automatici.

## Di cosa si tratta

`opencode-cc-camouflage` e un plugin di manutenzione che:

- Verifica la sicurezza delle patch prima di qualsiasi modifica
- Applica le patch al plugin peer quando lo richiedi esplicitamente
- Annulla le patch quando devi ripristinare lo stato precedente
- Segnala lo stato e fornisce indicazioni diagnostiche

Non applica patch automaticamente durante l'installazione. Ogni modifica richiede
l'invocazione esplicita dello strumento.

## Prerequisiti e ordine di installazione

L'ordine di installazione e importante. Devi avere i seguenti componenti installati prima che questo
plugin possa funzionare:

1. **`not-claude-code-emulator`** (commit `5541e5c`)
   - Il runtime dei messaggi che fornisce interfacce compatibili con Anthropic
   - Clona in `~/github/not-claude-code-emulator`

2. **`opencode-anthropic-auth`** (commit `6594dd1`)
   - Il plugin peer che gestisce l'OAuth di Anthropic
   - Installa come plugin OpenCode insieme a questo pacchetto

3. **`opencode-cc-camouflage`** (questo pacchetto)
   - Installa per ultimo, dopo che l'emulatore e il plugin peer sono presenti

Consulta [docs/install.md](docs/install.md) per i passaggi dettagliati.

## Strumenti disponibili

Questo plugin espone quattro strumenti espliciti. Non sono hook automatici.

### `status`

Segnala lo stato corrente dell'installazione del plugin peer.

```bash
bun run status
```

Il formato di output e leggibile dalla macchina:

```
peer=present
emulator=present
patch=clean
install_mode=local-folder
support=supported
```

Il codice di uscita 0 indica che tutto e a posto. Il codice di uscita 1 indica che qualcosa richiede attenzione.

### `doctor`

Fornisce indicazioni diagnostiche basate sullo stato corrente.

```bash
bun run doctor
```

Questo ispeziona i file e segnala i passaggi successivi da intraprendere. Non installa,
applica patch o modifica nulla. Legge e segnala solo.

### `patch_apply`

Applica la patch fissata al plugin peer.

```bash
bun run patch:apply
```

Richiede:
- Che il plugin peer sia presente
- Che i controlli pre-volo della patch siano superati
- Una directory peer con permessi di scrittura

Crea marker di rollback prima di modificare i file.

### `patch_revert`

Annulla una patch applicata in precedenza.

```bash
bun run patch:revert
```

Utilizza i marker di rollback per ripristinare lo stato pre-patch. I marker devono corrispondere
all'hash della patch corrente affinche il ripristino possa procedere.

## Perche gli hook automatici sono solo per la verifica

Gli hook automatici (`command.execute.before`, `tool.execute.after`) in questo plugin
sono limitati alla sola verifica e metadati. Non applicano patch
automaticamente perche:

1. Modificare un plugin peer senza l'intenzione esplicita dell'utente viola il principio
   della minima sorpresa
2. I fallimenti delle patch richiedono la revisione umana, non tentativi silenziosi
3. Il rollback richiede il consenso esplicito per ripristinare lo stato

Gli hook avvertono quando viene rilevata una deriva. Tu decidi se applicare, annullare o
lasciare l'ambiente invariato.

## Supporto piattaforme

| Piattaforma | Stato | Note |
|-------------|-------|------|
| macOS    | Supportato | Ambiente desktop principale |
| Linux    | Supportato | Stesse fixture upstream fissate |
| Windows  | Non supportato | Nessuna promessa per v1 |

Consulta [docs/support-matrix.md](docs/support-matrix.md) per le versioni
delle fixture bloccate.

## Rollback

Se devi annullare l'applicazione di una patch:

```bash
bun run patch:revert
```

Consulta [docs/rollback.md](docs/rollback.md) per i passaggi concreti e la risoluzione dei problemi.

## Canary di compatibilita

Per verificare la deriva upstream rispetto ai target fissati:

```bash
bun run compat:canary
```

Questo e un controllo di sola lettura che valida l'integrita delle fixture e i riferimenti
upstream senza modificare nulla. Esce con 0 sui target supportati fissati.

Consulta [docs/next-release.md](docs/next-release.md) per i dettagli sul workflow
del canary.

## Documentazione

- [docs/install.md](docs/install.md) - Prerequisiti e passaggi di installazione
- [docs/rollback.md](docs/rollback.md) - Passaggi concreti per il rollback
- [docs/compatibility.md](docs/compatibility.md) - Confini di compatibilita
- [docs/next-release.md](docs/next-release.md) - Canary di deriva upstream
- [docs/support-matrix.md](docs/support-matrix.md) - Versioni delle fixture bloccate
- [docs/non-goals.md](docs/non-goals.md) - Elementi esplicitamente fuori ambito
- [docs/patch-inventory.md](docs/patch-inventory.md) - Classificazione degli asset delle patch
- [docs/upstream-locks.md](docs/upstream-locks.md) - Riferimenti delle fixture di sviluppo

## Sviluppo

```bash
# Installa le dipendenze
bun install

# Controllo dei tipi
bun run typecheck

# Esegui i test
bun run test:unit
bun run test:integration

# Verifica le patch rispetto alle fixture
bun run verify:patches

# Controlla la sicurezza di pubblicazione
bun run check:publish-safety
```

## Licenza

MIT
