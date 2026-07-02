# macOS 分步實作計畫（Step Plan S1–S20）

把 [`macos-app-execution-plan.md`](macos-app-execution-plan.md) 的里程碑 M2–M8
拆成 20 個可獨立執行、可獨立驗收的步驟。**用法：對 Claude 說「請完成 step N」**
（或「請完成 step 2–6」一次做一段），每步做完都會 commit + push + 在
issue [#2](https://github.com/pcpcchen-coder/TranslationKonjac/issues/2) 打勾。

- 追蹤 issue：#2（內含 S1–S20 checklist）
- 開發分支：`claude/adoring-davinci-BrGrU`
- 前置狀態：M0 決策完成、M1 scaffold 完成（commit `9f83323`）

---

## 0. 開發方式與原則

### 每一步的固定流程（Definition of Done）
1. **先寫測試（紅）**：依本文件該步驟列出的測試案例建立測試檔，確認失敗。
2. **實作（綠）**：寫最小實作讓測試通過。
3. **全套回歸**：跑根目錄 `npm test`（web + macos 全部），必須全綠。
4. **Commit + push** 到開發分支，commit message 標注 `[S<N>]`。
5. **更新 issue #2** 的 Step Tracker 打勾。
6. 回報結果（含哪些是自動驗證、哪些留待 Mac 實機）。

### TDD 在這個專案的邊界（誠實聲明）
這個 repo 的遠端開發環境是 **Linux 容器、無桌面、無 macOS**。因此：

- **能自動化 TDD 的**：所有純邏輯／Node 可執行的部分——金鑰儲存、驗證、
  IPC contract、狀態機、裝置選擇邏輯、更新檢查、伺服器整合。策略與 M1 相同：
  **把邏輯抽成不 import electron 的模組**，用 `node --test` 驗證。
- **不能自動化、集中到 Phase B 的**：開視窗、macOS 權限彈窗、Keychain 實體
  行為、`setSinkId`/BlackHole/LINE 實機音訊、簽章/notarize、autoUpdater 端對端。
  這些步驟（S15–S20）由你在 Mac mini M4 上執行驗收清單，我遠端修問題。

### 兩個階段
- **Phase A（S1–S14）**：雲端可完成，不需 Mac。每步含自動化測試。
- **Phase B（S15–S20）**：需要 Mac mini M4 實機（部分需 Apple Developer ID、
  BlackHole、LINE 通話對象）。
- ⚠️ **建議現在就並行啟動**：Apple Developer Program 註冊（US$99/年）有審核
  等待時間（可能 1–2 天），是 S18/S19 的硬前置。不用等 Phase A 做完才申請。

---

## 1. 步驟總覽

| Step | 內容 | 里程碑 | 執行地點 | 依賴 |
|---|---|---|---|---|
| S1 | GitHub Actions CI：push/PR 自動跑測試 | 橫切 | 雲端 | — |
| S2 | Secret store 抽象層（file 後端 + keytar 動態載入） | M2 | 雲端 | — |
| S3 | API key 格式驗證 + 線上驗證 helper | M2 | 雲端 | — |
| S4 | 金鑰即時生效：live env 注入 server | M2 | 雲端 | — |
| S5 | IPC contract 模組（channel + payload 驗證器） | M2/M4 | 雲端 | — |
| S6 | 首次啟動流程狀態機 + main.js 接線 | M2 | 雲端 | S2,S3 |
| S7 | 權限 policy + 選單 template 抽成純模組 | M3 | 雲端 | — |
| S8 | 設定頁 renderer（HTML/JS + 純邏輯模組） | M4 | 雲端 | S5 |
| S9 | 設定頁 main process handlers（含金鑰即時更新） | M4 | 雲端 | S2–S6,S8 |
| S10 | 桌面 capability gating：隱藏分頁擷取、調整預設 | M5 | 雲端 | — |
| S11 | 單向模式輸入裝置選擇器（補分頁情境缺口） | M5 | 雲端 | S10 |
| S12 | 更新檢查核心（版本比較 + GitHub Releases 判讀） | M7 | 雲端 | — |
| S13 | 更新接線：IPC + 設定頁 UI + fallback 策略 | M7 | 雲端 | S5,S8,S12 |
| S14 | 打包設定回歸測試 + BUILD.md 建置手冊 | M6 | 雲端 | S8 |
| S15 | Mac 實機 bring-up：開窗、首次設定、Keychain、麥克風 | M2/M3/M4 驗證 | **Mac** | S1–S9 |
| S16 | 音訊裝置實機驗證：BlackHole、setSinkId、單向 | M5 驗證 | **Mac** | S10,S11,S15 |
| S17 | 雙向 LINE 實機驗證：隔離 + echo guard | M5 驗證 | **Mac** | S16 |
| S18 | 簽章 + notarize + arm64 DMG（Gatekeeper 乾淨安裝） | M6 | **Mac** | S14,S15,Developer ID |
| S19 | App 內更新端對端（發測試 Release → 偵測 → 安裝） | M7 驗證 | **Mac** | S13,S18 |
| S20 | 最終 QA matrix + 文件收尾 + 發佈 v1.0 | M8 | **Mac**+雲端 | 全部 |

估時：Phase A 每步約 0.5–1 個工作階段（可多步連做）；Phase B 依實機/等待時間，
約 2–4 個日曆天（S18 受 Apple 流程影響最大）。

---

## 2. Phase A 詳細規格（S1–S14）

### S1 — CI：GitHub Actions 自動測試
**目標**：之後每一步的 TDD 成果在 push 時自動驗證，不再依賴手動跑測試。

- **產出**：`.github/workflows/test.yml`
  - 觸發：push / pull_request
  - `ubuntu-latest`，Node 20 + 22 matrix
  - `npm install`（設 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`，CI 不需下載 ~100MB
    Electron 二進位，測試層不用它）→ `npm test`
- **測試（先寫）**：本步驟的「測試」即 workflow 本身對既有 38 個測試的執行。
- **驗收**：GitHub Actions 對分支顯示綠勾（用 GitHub MCP `actions_*` 工具確認）。

### S2 — Secret store 抽象層
**目標**：金鑰儲存介面，macOS 用 Keychain（keytar），其他環境/測試用權限受限
的本機檔案。這是「renderer 永遠拿不到金鑰」架構的地基。

- **產出**：`apps/macos/electron/secret-store.js`
  - `resolveSecretStore({ keytarImpl?, fileDir, serviceName })` → store
  - store API：`getApiKey()` / `setApiKey(key)` / `clearApiKey()` / `backendName`
  - keytar 用 `await import("keytar")` 動態載入（try/catch），失敗→file 後端
  - file 後端：JSON 檔，POSIX 權限 **0600**
  - `package.json` 加 `optionalDependencies: { keytar }`
- **先寫測試**（`apps/macos/test/secret-store.test.js`）：
  1. file 後端 set → get round-trip
  2. 未設定時 get 回傳 `null`
  3. 覆寫舊值
  4. `clearApiKey()` 後回 `null`
  5. 檔案權限為 0600（非 Windows 平台）
  6. 注入 fake `keytarImpl` → 選 keytar 後端且呼叫對應 get/set/deletePassword
  7. `keytarImpl` 載入失敗（reject）→ 無聲降級到 file 後端
- **驗收**：測試 7/7 綠；Keychain 實體行為留待 S15。

### S3 — API key 驗證 helpers
**目標**：首次設定與設定頁都要用的兩層驗證：格式（本機、即時）與有效性（線上）。

- **產出**：`apps/macos/electron/api-key.js`
  - `validateApiKeyFormat(key)` → `{ ok, error? }`（trim、非空、`sk-` 開頭、
    無空白、長度下限）
  - `verifyApiKeyOnline({ apiKey, fetchImpl })` → `{ ok, reason? }`：
    GET `https://api.openai.com/v1/models`；200→ok、401→`unauthorized`、
    網路錯誤→`network`（可重試）
- **先寫測試**（`test/api-key.test.js`）：格式 5 案（合法/空/空白夾雜/非 sk-/
  過短）；線上 4 案（200、401、500、fetch throw）——全部用注入的 fake fetch。
- **驗收**：9 案全綠，零真實網路呼叫。

### S4 — 金鑰即時生效（live env）
**目標**：證明「設定頁更新 key 之後**不用重啟**就生效」。`apps/web/src/server.js`
的 `/session` handler 本來就是**每個 request 當下**讀 `env.OPENAI_API_KEY`，
所以只要 main process 與 server 共享同一個 env 物件、事後改值即可——這一步
把這個關鍵行為用測試釘死，並讓 `startTranslationServer` 支援 `fetchImpl` 注入。

- **產出**：`server-runtime.js` 增加 `fetchImpl` 傳遞給 `buildServer`。
- **先寫測試**（擴充 `test/server-runtime.test.js`）：
  1. 用 `env={}` 啟動 → POST /session → 500（缺 key）
  2. **不重啟**，直接 `env.OPENAI_API_KEY = "sk-test..."`（fake fetch 回 200
     client secret）→ 再 POST → 200
  3. 再把 key 改成另一把 → fake fetch 收到的 Authorization header 換新
- **驗收**：3 案綠。這是 M4「即時生效不需重裝」驗收項的自動化證明。

### S5 — IPC contract 模組
**目標**：renderer↔main 的通道與 payload 用單一模組定義並驗證，
**用 schema 層面保證完整金鑰永遠不會流向 renderer**。

- **產出**：`apps/macos/electron/ipc-contract.js`
  - channels：`settings:get-key-status` / `settings:set-key` /
    `settings:clear-key` / `settings:verify-key` / `update:check` /
    `app:open-external` / `app:get-info`
  - 每個 channel 的 request/response validator，重點：
    - `get-key-status` response 只允許 `{ hasKey, last4, backend }`，
      validator **拒絕**任何值匹配 `/^sk-[A-Za-z0-9]/ 且長度 > 8` 的 payload
    - `open-external` 只允許 `https://github.com/pcpcchen-coder/TranslationKonjac`
      前綴的 URL（防 renderer 被注入任意開網址）
- **先寫測試**（`test/ipc-contract.test.js`）：每個 validator 正反各至少一案；
  特別是「payload 夾帶完整 key → 拒絕」與「非白名單 URL → 拒絕」。
- **驗收**：validator 測試全綠。之後 S9/S13 的 handler 都必須過這層。

### S6 — 首次啟動流程
**目標**：`有 key → 直接啟動；沒 key → 引導設定` 的狀態機，抽成純模組。

- **產出**：`apps/macos/electron/app-flow.js`
  - `resolveStartupFlow({ store })` → `{ action: "start" | "prompt-key" }`
  - `completeKeySetup({ store, key, validateImpl, verifyImpl? })` →
    `{ ok, error? }`（格式錯→不碰 store；通過→存入）
  - `main.js` 接線：`prompt-key` 時先開主視窗 + 原生 dialog 提示
    「請按 ⌘, 開啟設定輸入 API key」（S9 完成後改成自動開設定視窗）
- **先寫測試**（`test/app-flow.test.js`）：無 key→prompt；有 key→start；
  setup 格式錯誤→error 且 store 未變；合法→寫入 store；驗證 impl 全注入。
- **驗收**：測試綠；dialog 視覺留待 S15。

### S7 — 權限 policy + 選單抽純模組
**目標**：把 M1 埋在 `main.js` 的權限與選單邏輯抽出來測試，並鎖死
「分頁/螢幕擷取一律拒絕」這個決策 2 的技術保證。

- **產出**：
  - `apps/macos/electron/permissions.js`：`decidePermission(permission, details)`
    → boolean。規則：`media` 且 mediaTypes 只含 audio → 允許；
    含 video → 拒絕；`display-capture` → **拒絕**；其他 → 拒絕。
  - `apps/macos/electron/menu-template.js`：`buildMenuTemplate({ appName,
    onOpenSettings, onOpenGitHub, isMac })` → template 陣列
  - `main.js` 改為 import 這兩個模組
- **先寫測試**（`test/permissions.test.js`、`test/menu-template.test.js`）：
  權限 5 案（audio 允許 / video 拒 / display-capture 拒 / geolocation 拒 /
  未知拒）；選單結構案（含 Settings + `Cmd+,`、Quit、Reload、DevTools、
  GitHub 項；非 mac 平台不含 app menu）。
- **驗收**：測試綠；`main.js` 行為不變（回歸靠既有 2 測 + S15 實機）。

### S8 — 設定頁 renderer
**目標**：獨立設定視窗的頁面本體。DOM 保持薄，邏輯全部抽到可測模組。

- **產出**：
  - `apps/macos/renderer/settings.html` / `settings.css` / `settings.js`
    （CSP meta、無遠端資源；顯示：金鑰狀態、輸入框、儲存/清除/驗證按鈕、
    更新區塊佔位、後端名稱 Keychain/file）
  - `apps/macos/renderer/settings-logic.js`（**純邏輯，無 DOM**）：
    - `maskKeyStatus({ hasKey, last4, backend })` → 顯示字串（`sk-…abcd ・ Keychain`）
    - `deriveFormState(input)` → `{ canSave, hint }`
    - `nextState(state, event)` → 儲存生命週期狀態機
      （idle→saving→saved/error，含 verify 中）
    - `buildUpdateStatusText(response)` → 字串（S13 會擴充案例）
  - `package.json` `build.files` 加入 `renderer/**`（S14 有測試釘住）
- **先寫測試**（`test/settings-logic.test.js`）：mask 3 案（有 key/無 key/
  file 後端標示）；form 4 案（空、含空白、合法、太短）；狀態機 5 案；
  update 文案 2 案（先佔位）。
- **驗收**：邏輯測試全綠；視覺留待 S15。

### S9 — 設定頁 main handlers（M2+M4 合流點）
**目標**：設定頁背後的 main process 實作，串起 S2–S6 全部零件，
完成「首次啟動輸入、之後隨時更新、即時生效」的完整閉環。

- **產出**：
  - `apps/macos/electron/settings-handlers.js`：
    `createSettingsHandlers({ store, env, validateImpl, verifyImpl })` →
    handler map（純函式物件，**不 import electron**）：
    - `get-key-status`：讀 store → `{ hasKey, last4, backend }`
    - `set-key`：validate → store.setApiKey → **`env.OPENAI_API_KEY = key`**
      → `{ ok }`
    - `clear-key`：清 store + `delete env.OPENAI_API_KEY`
    - `verify-key`：呼叫 S3 線上驗證
  - `main.js`：`ipcMain.handle` 逐一掛上（過 S5 contract validator）；
    首次啟動（S6 的 prompt-key）改為**自動開啟設定視窗**
  - `preload.cjs`：暴露 `getKeyStatus/setKey/clearKey/verifyKey` 白名單 API
- **先寫測試**（`test/settings-handlers.test.js`）：
  1. get-key-status 無 key / 有 key（last4 正確、**絕無完整 key**，
     用 S5 validator 驗 response）
  2. set-key 格式錯 → error、store/env 未動
  3. set-key 成功 → store 有值且 env 已更新
  4. **整合案**：起 S4 的 live server（fake fetch）→ set-key → POST /session
     → 200 且 Authorization 帶新 key ——「改 key 即時生效」端對端（Node 內）證明
  5. clear-key → /session 回到 500
- **驗收**：含整合案全綠。這步完成後 M2+M4 的可自動化部分全部落地。

### S10 — 桌面 capability gating（決策 2 落地・上）
**目標**：桌面 app 內移除 Chrome 分頁擷取入口；**web 版行為完全不變**。
用 M1 preload 已暴露的 `window.translationKonjac` 當桌面偵測訊號。

- **產出**：
  - `apps/web/src/public/desktop-capabilities.js`（新，屬共用前端）：
    - `detectDesktop(globals)` → boolean
    - `availableOneWaySources(isDesktop)` → web:`["tab","microphone"]`／
      desktop:`["microphone"]`
    - `availableInboundSources(isDesktop)` → web:`["tab","device"]`／
      desktop:`["device"]`
    - `defaultSelections(isDesktop)` → 桌面預設：單向=microphone、
      inbound=device
  - `app.js` + `index.html` 接線：桌面模式隱藏分頁選項、鎖定預設、
    調整按鈕/說明文案（web 上一切照舊）
- **先寫測試**（`apps/web/test/desktop-capabilities.test.js`）：
  detect 3 案（無 bridge/有 bridge/畸形 globals）；sources×2×2；defaults 2 案。
  另在 `server.test.js` 補一條：index.html 有載入新模組。
- **驗收**：新測試綠 + **web 既有 36 測全數不變**（證明 web 版無回歸）。

### S11 — 單向模式輸入裝置選擇器（決策 2 落地・下）
**目標**：補上拿掉分頁擷取後的功能缺口——原「翻譯其他 App/分頁聲音」情境，
桌面版改為：**單向模式可明確選擇輸入裝置**（例：BlackHole 16ch），
而不是只能用系統預設麥克風。

- **產出**：
  - `desktop-capabilities.js` 增加
    `chooseOneWayCaptureOptions({ isDesktop, deviceId, deviceLabel })`：
    - 未選裝置 → 既有 `buildMicrophoneMediaOptions()`（EC/NS/AGC 開）
    - 選了 BlackHole/虛擬裝置（label 判斷）→ raw 選項（**EC/NS/AGC 關**，
      復用 `buildRawAudioInputMediaOptions`，虛擬迴路訊號不能被降噪毀掉）
    - 選了一般外接麥克風 → 帶 deviceId 的處理選項
  - `index.html`：新增 `#oneWayInputDevice`（桌面 + microphone 來源時顯示）
  - `app.js`：填充輸入裝置清單（復用 `fillInputSelect`）、擷取改走新選項函式
- **先寫測試**（擴充 `desktop-capabilities.test.js`）：4 案
  （預設/BlackHole label/一般裝置/web 模式不受影響）。
- **驗收**：測試綠。實際「翻譯其他 App 聲音」流程在 S16 實機驗證。

### S12 — 更新檢查核心
**目標**：不依賴 electron-updater 的純更新判斷邏輯（同時就是無簽章 fallback）。

- **產出**：`apps/macos/electron/update-check.js`
  - `compareVersions(a, b)`（處理 `v` 前綴、三段數字）
  - `checkForUpdate({ currentVersion, fetchImpl, repo })` →
    GET `https://api.github.com/repos/<repo>/releases/latest` →
    `{ status: "update-available", version, url(dmg asset 優先, 退 html_url) }`
    ／`{ status: "up-to-date" }`／`{ status: "no-releases" }`（404）／
    `{ status: "error", retriable }`
  - `releasesPageUrl(repo)`
- **先寫測試**（`test/update-check.test.js`）：版本比較 6 案（含 v 前綴、
  雙位數、相等、dev 版超前）；checkForUpdate 6 案（新版可用含 dmg asset/
  無 asset 退頁面/相同版本/404/500/fetch throw/畸形 JSON）。
- **驗收**：12 案全綠，零真實網路。

### S13 — 更新接線（IPC + 設定頁 UI + 策略）
**目標**：把 S12 接進設定頁；簽章版走 electron-updater、未簽章走手動下載
fallback，策略本身可測。

- **產出**：
  - `update-check.js` 增 `decideUpdateStrategy({ isPackaged, updaterAvailable })`
    → `"electron-updater" | "manual-fallback"`
  - `apps/macos/electron/update-handlers.js`：
    `createUpdateHandlers({ strategy, checkImpl, openExternalImpl, appVersion })`
    （純函式，electron-updater 以 lazy import 注入）
  - `main.js` 掛 `update:check` / `app:open-external`（過 S5 contract）
  - 設定頁：「檢查更新」按鈕 + 狀態列 + 「前往下載」按鈕（fallback 時）；
    `settings-logic.js` 的 `buildUpdateStatusText` 補齊全部狀態文案
  - `package.json` 加 `electron-updater` 依賴（僅打包後啟用）
- **先寫測試**：strategy 3 案；handlers 4 案（fallback 檢查回傳 URL/
  up-to-date/error/open-external 白名單擋非法 URL）；文案 5 案。
- **驗收**：測試綠。真簽章 autoUpdater 端對端留 S19。

### S14 — 打包設定回歸測試 + BUILD.md
**目標**：用測試把 electron-builder 設定「釘住」，防後續步驟不小心弄壞打包；
寫出 Mac 上的建置/簽章手冊，S18 照著跑。

- **產出**：
  - `test/build-config.test.js`：斷言 `build.mac.target` 含 dmg+arm64、
    `hardenedRuntime: true`、entitlements 檔存在、
    `extendInfo.NSMicrophoneUsageDescription` 非空、`extraResources` 映射
    `../web/src → web/src`、`files` 含 `electron/**` **與 `renderer/**`**、
    icon 產生器可執行且產出 PNG
  - `apps/macos/BUILD.md`：本機 dev、打包、簽章環境變數
    （`APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`、憑證）、
    notarize 流程、常見錯誤排查（首次 notarize 陷阱清單）
- **驗收**：設定測試全綠；BUILD.md 完整到 S18 可照抄執行。

---

## 3. Phase B 詳細規格（S15–S20，需要 Mac mini M4）

> 這一段的分工：**你在 Mac 上執行驗收清單**（每步 30 分–2 小時），
> 把結果/錯誤訊息貼回來，**我遠端修正再推**。每步同樣以 issue 打勾收尾。

### S15 — Mac 實機 bring-up
**前置**：Phase A 完成（至少 S1–S9）。
**你執行**：`git pull` → `npm install` → `npm run macos:dev`。
**驗收清單**：
- [ ] 視窗開啟、載入翻譯介面
- [ ] 首次啟動自動跳設定視窗，輸入 key 可存
- [ ] Keychain Access.app 看得到 `TranslationKonjac` 項目（keytar 後端生效）
- [ ] 重開 app 不再要求 key（持久化）
- [ ] 設定頁改 key → 不重啟直接生效（開始一次翻譯測試）
- [ ] macOS 麥克風權限彈窗出現且記住
- [ ] ⌘, 開設定、選單各項可用
- [ ] DevTools 檢查：`window.translationKonjac` 無金鑰、Network 的 /session
  response 只含短效 client_secret

### S16 — 音訊裝置實機驗證（單向）
**前置**：S15；安裝 BlackHole 2ch + 16ch。
**驗收清單**：
- [ ] app 內 `enumerateDevices` 列出 BlackHole 2ch/16ch（含 label）
- [ ] 單向：預設麥克風 → 翻譯 → 指定實體耳機輸出（setSinkId 綁定驗證）
- [ ] 單向：輸入裝置選 BlackHole 16ch，播另一個 App 的聲音導入 → 翻譯成功
  （**原 Chrome 分頁情境的替代驗證**，S11 的成果）
- [ ] 輸出選 BlackHole 2ch → 診斷列顯示 sinkId 正確綁定

### S17 — 雙向 LINE 實機驗證
**前置**：S16；LINE + 通話對象一位。
**驗收清單**（對照 `apps/web/README.md` 既有操作手冊）：
- [ ] LINE mic=BlackHole 2ch、speaker=BlackHole 16ch；app outbound=BH2ch、
  inbound source=BH16ch、inbound output=實體耳機
- [ ] 對方聽到英文、你聽到中文
- [ ] Echo guard：inbound 播放時 `Outbound mic` 診斷短暫 muted/detached 後恢復
- [ ] 無回音/迴圈；30 分鐘穩定性通過
- [ ] 嚴格隔離：故意選錯（inbound 輸出選 BlackHole）→ 啟動被擋

### S18 — 簽章 + notarize + DMG
**前置**：S14–S15；**Apple Developer ID 已核發**（建議現在就申請）。
**你執行**：照 `BUILD.md` 設好憑證與環境變數 → `npm run macos:dist`。
**驗收清單**：
- [ ] 產出 arm64 DMG；`spctl -a -vv` / Gatekeeper 乾淨
- [ ] 乾淨環境（另一使用者帳號或另一台 Mac）：開 DMG → 拖 Applications →
  Dock 啟動無警告
- [ ] **打包版**重跑 S15 關鍵項（打包後資源路徑 `resourcesPath/web/src`
  是首次真正被走到的路徑，最可能出包，我遠端修）
- [ ] 打包版跑一次單向翻譯

### S19 — App 內更新端對端
**前置**：S13、S18。
**流程**：我發一個測試用 GitHub Release（含 DMG + electron-builder 的
`latest-mac.yml`）→ 你在較舊版號的已安裝 app 內按「檢查更新」。
**驗收清單**：
- [ ] 設定頁偵測到新版
- [ ] autoUpdater 下載 + 重啟安裝成功（簽章版）
- [ ] （對照組）故意用未簽章 dev 版 → 正確退到「前往下載」fallback

### S20 — 最終 QA + 文件 + 發佈
- [ ] 跑完 `macos-app-execution-plan.md` 的完整 QA matrix（9 項驗收標準）
- [ ] `apps/macos/README.md` 使用者版安裝說明（含中文快速上手：權限、
  BlackHole、API key、更新）
- [ ] 根 `README.md` macOS 段落更新
- [ ] 發佈 v1.0.0 Release（DMG + 更新 feed）
- [ ] issue #2 全部打勾、關閉

---

## 4. 里程碑對照表

| 里程碑 | 對應步驟 |
|---|---|
| M2 Session server + 金鑰 | S2, S3, S4, S6（S9 收尾） |
| M3 權限與原生外殼 | S7（S15 驗證） |
| M4 設定頁面 | S5, S8, S9（S15 驗證） |
| M5 移除分頁擷取 + 音訊驗證 | S10, S11（S16, S17 驗證） |
| M6 簽章/打包 | S14, S18 |
| M7 App 內更新 | S12, S13, S19 |
| M8 QA 與文件 | S20 |
| 橫切（測試基礎建設） | S1 |

## 5. 風險與備註

1. **S18 是行程上的長桿**：Apple Developer 註冊 + 首次 notarize 除錯，
   建議註冊現在就送件，Phase A 期間並行等待。
2. **S9 的整合測試是本計畫的核心保證**：「改 key 即時生效 + renderer 拿不到
   完整 key」都在 Node 層有自動化證明，Mac 上只驗 UI 細節。
3. **S10/S11 動到共用前端 `apps/web`**：以 capability gating 實作
   （桌面隱藏、web 不變），web 既有 36 測不變是硬性驗收條件——決策 2 的
   「移除」是移除桌面入口，web 版保留分頁功能不受影響。
4. 步驟可以合併下指令（例：「請完成 step 2–6」= M2 一次完成）；
   若執行時發現前置缺漏或設計需要調整，我會先說明再動工。
5. Fable/Opus/Sonnet 模型選用建議見
   [`macos-model-cost-plan.md`](macos-model-cost-plan.md)（S10/S11 動
   `app.js` 的部分屬於該文件標記為高風險的 M5 範圍，執行那兩步時建議搭配
   `/code-review`）。
