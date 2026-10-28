# VIVER · підключення чотирьох платформ

Підготовлено власний Cloudflare Worker **viver-auth** та окрему базу **viver-oauth-db**. Нічого не пов'язано з іншими проєктами. Сайт продовжує публікуватися через GitHub Actions → GitHub Pages.

**Статус:** серверний код і UI розгорнуті, але OAuth-підключення залишаються недоступними, доки не налаштовані ключ шифрування та офіційні застосунки провайдерів. Не додавай фіктивні Client ID і ніколи не зберігай Client Secret у GitHub.

## 1. Cloudflare

Worker: `viver-auth`  
Адреса: `https://viver-auth.flekideveloper.workers.dev`  
База: `viver-oauth-db` (D1, EU)  
Binding: `DB`  
Worker `GET /health` показує `providers.youtube/tiktok/twitch/x`, які активуються лише після додавання відповідних ключів.

У Cloudflare Dashboard → Workers & Pages → **viver-auth** → Settings → Variables and Secrets додай **секрет** `TOKEN_KEY`: довільні **32 криптографічно випадкові байти**, закодовані Base64 або Base64URL. Генеруй локально, не відправляй його в чат або GitHub.

Windows PowerShell (підтримувана команда):

```powershell
$bytes = New-Object byte[] 32; $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes); $rng.Dispose(); [Convert]::ToBase64String($bytes)
```

Додай отримане значення як **Secret** `TOKEN_KEY` (не як звичайну змінну). Не змінюй цей ключ після підключення акаунтів: старі зашифровані токени стане неможливо прочитати.

## 2. Створи окремі OAuth apps для VIVER

Налаштовуй у відповідних *офіційних* кабінетах розробників. Усі адреси callback треба додавати точно.

| Платформа | Cloudflare Secrets | Callback URL |
| --- | --- | --- |
| YouTube (Google) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `https://viver-auth.flekideveloper.workers.dev/auth/callback/youtube` |
| TikTok Login Kit (Web) | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | `https://viver-auth.flekideveloper.workers.dev/auth/callback/tiktok` |
| Twitch | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | `https://viver-auth.flekideveloper.workers.dev/auth/callback/twitch` |
| X (OAuth 2.0 Web App) | `X_CLIENT_ID`, `X_CLIENT_SECRET` | `https://viver-auth.flekideveloper.workers.dev/auth/callback/x` |

- **Google:** у Google Cloud Console створи проєкт VIVER, налаштуй OAuth consent screen, увімкни YouTube Data API v3 **та YouTube Analytics API**, створи клієнт типу *Web application*, додай redirect URI. Scopes: `https://www.googleapis.com/auth/youtube.readonly` і `https://www.googleapis.com/auth/yt-analytics.readonly` (обидва read-only). У Google Auth Platform → Data Access додай ці дозволи. Для деяких режимів і користувачів може знадобитися публікація / перевірка застосунку.
- **TikTok:** створи застосунок із **Login Kit for Web** та Display API. Зараз VIVER запитує `user.info.basic,user.info.profile,user.info.stats,video.list` для профілю, фоловерів, лайків та власних публічних відео. Кожен scope потрібно дозволити в TikTok Developer Portal; для деяких потрібні перевірка застосунку та approval. Після зміни scopes підключи TikTok повторно.
- **Twitch:** створи confidential застосунок у Twitch Developer Console з точним redirect URI. VIVER запитує `moderator:read:followers` для кількості фоловерів; Helix API надає також поточний стрім, глядачів онлайн, доступні VOD і кліпи. Окремі повні звіти утримання/приросту за минулі 7 днів Twitch Helix у такому вигляді не надає.
- **X:** у Developer Console створи Web App (confidential) з OAuth 2.0 і Callback URL. Scopes: `users.read tweet.read offline.access`. VIVER читає дозволені `public_metrics` профілю й пости. X API має тарифні/квотні обмеження та може не повертати impressions; VIVER не показує вигадані значення.

Після додавання ключів у Worker його `/health` автоматично покаже `true` для налаштованих платформ. Кнопка «Підключити» у VIVER стане доступною. Кожен провайдер налаштовується незалежно.

## Як це працює

1. На GitHub Pages вебсайт створює локальний випадковий ключ зберігання та звертається тільки до VIVER Worker.
2. Worker створює одноразовий OAuth `state` у D1 (TTL 10 хв) та, де потрібно, PKCE S256.
3. Користувач входить безпосередньо на сайт провайдера і підтверджує дозволи.
4. Код авторизації обмінюється на токени лише на сервері. Акаунт перевіряється офіційним профільним API.
5. Токени та refresh-токени зберігаються в D1, зашифровані AES-GCM ключем `TOKEN_KEY`. У браузері доступні тільки назва та статус.
6. Відключення видаляє токени з VIVER. Для повного відкликання дозволів додатково використовуй сторінку пов'язаних застосунків відповідної платформи.

**Обмеження:** прив'язка акаунтів у цій версії **до конкретного браузера**, а не до логіну у VIVER. Не очищуй localStorage `viver-connect-key-v1`, якщо хочеш зберегти доступ до своїх підключень; локальні планер/нотатки залишаються незалежними за ключем `viver-workspace-v1`. Для справжньої багатопристроєвої синхронізації потрібна окрема авторизація VIVER. Не вставляй токени в браузерну консоль.

## Тестування

```bash
node --check auth-worker/src/index.js
node tests/oauth.cjs
```

Для повторного розгортання Worker з репозиторію використовуй `cd auth-worker && npx wrangler deploy` під відповідним акаунтом Cloudflare; **секрети залишаються на сервері**. Після змін у коді Worker GitHub Pages автоматично оновить лише сайт, а Worker потрібно розгортати окремо.

Офіційні джерела:

- https://developers.google.com/youtube/data/guides/auth/server-side-web-apps
- https://developers.tiktok.com/docs/en/login-kit-web
- https://dev.twitch.tv/docs/authentication/getting-tokens-oauth
- https://docs.x.com/

## Аналітика YouTube в Огляді

Для метрик за останні 7 доступних днів VIVER використовує `GET /youtube/analytics` → YouTube Analytics API v2 `reports.query` (не лише Data API). Потрібно **увімкнути YouTube Analytics API** в Google Cloud → API Library, додати `yt-analytics.readonly` до Data Access і **повторно авторизувати** свій YouTube-канал у VIVER. Перепідключення того самого каналу не повинно стирати зібрані знімки Data API. Не передавай Client Secret та TOKEN_KEY в браузер чи GitHub.

Огляд показує:
- Повні 7 доступних звітних днів та порівняння з **попередніми 7 днями**, із точними датами. Google може обробляти останні дні із затримкою.
- `views`, `likes`, `comments`, `shares`, `subscribersGained`, `subscribersLost`, різницю нових і втрачених, `estimatedMinutesWatched`.
- Зміну (%) **нових підписок** і переглядів у порівнянні з попереднім тижнем. Якщо раніше було 0, результат у % не визначений і інтерфейс показує «—», а не нескінченний приріст.
- Реальні `insightTrafficSourceType`, `insightTrafficSourceDetail` для `YT_SEARCH`, типи пристроїв і країни глядачів, якщо API повернув ці зрізи.
- Окрему server-side D1 таблицю `youtube_analytics_cache` із приблизно 15-хвилинним кешем для економії квоти.

Для інших платформ VIVER відображає статус підключення без фальшивих чисел; вони отримають живу аналітику після налаштування їхніх OAuth/API-підключень.

Офіційні документи:
- https://developers.google.com/youtube/analytics/reference/reports/query
- https://developers.google.com/youtube/analytics/channel_reports
- https://developers.google.com/youtube/analytics/dimensions

## Вкладки аналітики v0.9

Кожен акаунт має окремий OAuth-ключ і доступ до своїх показників через `GET /social/{twitch|tiktok|x}/overview`. Вкладка платформи у **Статистиці** з'являється **тільки якщо відповідний акаунт реально підключений**. У YouTube збережено Creator Studio, включно з YouTube Analytics API.

Для Twitch, TikTok та X є вкладки **Огляд, Контент, Планер, Цілі, Сповіщення, Порівняння**. Це дані з офіційних API: лічильники профілю, опубліковані матеріали, поточний ефір у Twitch, та локальні цілі/події. Якщо немає історичного звіту, порівняння публікацій показує **накопичені лічильники**, а зміна за 7 днів з'являється тільки після наявності справжніх вимірювань із різницею 7 днів.

Сервер зберігає 15-хвилинний кеш у D1 `social_overview_cache` та історію щоденних знімків у `social_metric_snapshots`. Дані розділено за capability-hash, платформою та provider account ID. Відключення видаляє відповідні кеш і знімки. Локальні цілі й події зберігаються в браузері під `viver-social-studio-v1`.

Реєстрація застосунків TikTok, Twitch та X **не виконується автоматично**: налаштуй OAuth Client ID/Secret безпосередньо в Cloudflare Secrets. Без них реальний вхід і відповідні вкладки не працюватимуть. Для Google/YouTube повторно створювати акаунт не потрібно.
