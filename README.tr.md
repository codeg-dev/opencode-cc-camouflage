# opencode-cc-camouflage

OpenCode icin bir eslikci bakim eklentisi; Anthropic kimlik dogrulama eklentisi ile ilgili yamalari dogrulamaya, uygulamaya ve geri almaya yardimci olur. Bu paket, upstream projelerinin bir fork'u degildir. Otomatik kancalar olmadan acik araclama saglar.

## Bu nedir

`opencode-cc-camouflage` bir bakim eklentisidir ve sunlari yapar:

- Herhangi bir degisiklik oncesi yama guvenligini dogrular
- Siz acikca istediginizde peer eklentisine yama uygular
- Geri almaniz gerektiginde yamalari geri cevirir
- Durum raporu verir ve tani rehberligi saglar

Kurulum sirasinda otomatik yama yapmaz. Tum degisiklikler acik arac cagrisi gerektirir.

## On kosullar ve kurulum sirasi

Kurulum sirasi onemlidir. Bu eklenti calisabilmesi icin asagidakilerin yerinde olmasi gerekir:

1. **`not-claude-code-emulator`** (commit `5541e5c`)
   - Anthropic uyumlu arayuzler saglayan mesaj calisma zamani
   - `~/github/not-claude-code-emulator` konumuna klonlayin

2. **`opencode-anthropic-auth`** (commit `6594dd1`)
   - Anthropic OAuth isleyen peer eklentisi
   - Bu paketle birlikte OpenCode eklentisi olarak kurun

3. **`opencode-cc-camouflage`** (bu paket)
   - Emulator ve peer eklentisi hazir olduktan sonra en son kurun

Ayrintili adimlar icin [docs/install.md](docs/install.md) dosyasina bakin.

## Kullanilabilir araclar

Bu eklenti dort acik arac sunar. Bunlar otomatik kanca degildir.

### `status`

Peer kurulumunun mevcut durumunu raporlar.

```bash
bun run status
```

Cikti formati makine tarafindan okunabilir:

```
peer=present
emulator=present
patch=clean
install_mode=local-folder
support=supported
```

0 cikis kodu saglikli demektir. 1 cikis kodu dikkat gerektiren bir sey oldugu anlamina gelir.

### `doctor`

Mevcut duruma gore tani rehberligi saglar.

```bash
bun run doctor
```

Bu dosyalari inceler ve uygulanabilir sonraki adimlari raporlar. Kurulum yapmaz, yama uygulamaz veya hicbir seyi degistirmez. Sadece okur ve raporlar.

### `patch_apply`

Sabitlenmis yamayi peer eklentisine uygular.

```bash
bun run patch:apply
```

Bunlari gerektirir:
- Peer eklentisinin mevcut olmasi
- Yama on ucus kontrollerinin basarili olmasi
- Yazilabilir bir peer kok dizini

Dosyalari degistirmeden once geri alma isaretleyicileri olusturur.

### `patch_revert`

Once uygulanmis bir yamayi geri alir.

```bash
bun run patch:revert
```

Bu, yama oncesi durumu geri yuklemek icin geri alma isaretleyicilerini kullanir. Geri alma islemi icin isaretleyiciler mevcut yama hash'iyle eslesmelidir.

## Neden otomatik kancalar sadece dogrulama icindir

Bu eklentideki otomatik kancalar (`command.execute.before`, `tool.execute.after`) yalnizca dogrulama ve meta verilerle sinirlidir. Yamalari otomatik olarak uygulamazlar cunku:

1. Acik kullanici niyeti olmadan bir peer eklentisini degistirmek, en az saskinlik ilkesini ihlal eder
2. Yama hatalari sessiz yeniden denemeler degil, insan incelemesi gerektirir
3. Geri alma, durumu geri yuklemek icin acik onay gerektirir

Kancalar, sapma tespit edildiginde uyarir. Uygulamaya, geri almaya veya ortami degistirmeden birakmaya siz karar verirsiniz.

## Platform destegi

| Platform | Durum | Notlar |
|----------|--------|-------|
| macOS    | Destekleniyor | Birincil masaustu ortami |
| Linux    | Destekleniyor | Ayni sabit upstream fixture'lar |
| Windows  | Desteklenmiyor | v1 sozu yok |

Kilitli fixture surumleri icin [docs/support-matrix.md](docs/support-matrix.md) dosyasina bakin.

## Geri alma

Bir yama uygulamasini geri almaniz gerekirse:

```bash
bun run patch:revert
```

Somut adimlar ve sorun giderme icin [docs/rollback.md](docs/rollback.md) dosyasina bakin.

## Uyumluluk kanarya

Sabitlenmis hedeflere karsi upstream sapmasini kontrol etmek icin:

```bash
bun run compat:canary
```

Bu, fixture butunlugunu ve upstream referanslarini hicbir seyi degistirmeden dogrulayan salt okunur bir kontroldur. Sabitlenmis desteklenen hedeflerde 0 ile cikar.

Kanarya is akisi ayrintilari icin [docs/next-release.md](docs/next-release.md) dosyasina bakin.

## Dokumantasyon

- [docs/install.md](docs/install.md) - On kosullar ve kurulum adimlari
- [docs/rollback.md](docs/rollback.md) - Somut geri alma adimlari
- [docs/compatibility.md](docs/compatibility.md) - Uyumluluk sinirlari
- [docs/next-release.md](docs/next-release.md) - Upstream sapma kanaryasi
- [docs/support-matrix.md](docs/support-matrix.md) - Kilitli fixture surumleri
- [docs/non-goals.md](docs/non-goals.md) - Acik kapsam disi ogeler
- [docs/patch-inventory.md](docs/patch-inventory.md) - Yama varligi siniflandirmasi
- [docs/upstream-locks.md](docs/upstream-locks.md) - Gelistirme fixture referanslari

## Gelistirme

```bash
# Bagimliliklari kur
bun install

# Tip kontrolu
bun run typecheck

# Testleri calistir
bun run test:unit
bun run test:integration

# Fixture'lara karsi yamalari dogrula
bun run verify:patches

# Yayin guvenligini kontrol et
bun run check:publish-safety
```

## Lisans

MIT
