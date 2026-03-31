# 財務管家 PWA

個人財務追蹤 APP，支援多張信用卡、分期管理、訂閱追蹤、AI 分析、雲端同步。

---

## 快速部署（建議用 Vercel，5 分鐘完成）

### Step 1：設定 Supabase

1. 前往 [supabase.com](https://supabase.com) 建立免費帳號
2. 點「New Project」建立專案
3. 進入專案後，點左側「SQL Editor」
4. 貼上以下 SQL 並執行：

```sql
-- 建立資料表
create table if not exists public.user_data (
  user_id uuid references auth.users(id) on delete cascade primary key,
  data jsonb default '{}',
  updated_at timestamptz default now()
);

-- 啟用 Row Level Security
alter table public.user_data enable row level security;

-- 建立 RLS Policy（每個用戶只能存取自己的資料）
create policy "Users can manage own data"
  on public.user_data
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

5. 到「Project Settings > API」複製：
   - **Project URL**（VITE_SUPABASE_URL）
   - **anon public key**（VITE_SUPABASE_ANON_KEY）

### Step 2：設定環境變數

複製 `.env.example` 為 `.env`：

```bash
cp .env.example .env
```

填入你的 Supabase 設定：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 3：本地測試

```bash
npm install
npm run dev
```

### Step 4：產生 PWA 圖示

```bash
# 方法 A：自動（需要 sharp）
npm install sharp --save-dev
node generate_icons.cjs

# 方法 B：手動
# 將 public/icons/icon.svg 上傳到 https://svgtopng.com
# 分別匯出 192x192 和 512x512 PNG
# 儲存為 public/icons/icon-192.png 和 public/icons/icon-512.png
```

### Step 5：部署到 Vercel

**方法 A：GitHub + Vercel（推薦）**

1. 把專案推到 GitHub
2. 前往 [vercel.com](https://vercel.com) 登入
3. 「New Project」→ Import GitHub repo
4. 在「Environment Variables」填入：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. 點 Deploy，完成！

**方法 B：Netlify**

```bash
npm run build
# 把 dist/ 資料夾拖到 netlify.com/drop
# 在 Site Settings > Environment Variables 填入兩個環境變數
# 重新 Deploy
```

**方法 C：Vercel CLI**

```bash
npm install -g vercel
npm run build
vercel --prod
# 照提示填入環境變數
```

---

## 安裝到桌面（PWA）

### iPhone / iPad
1. 用 Safari 打開網址
2. 點下方分享按鈕 →「加入主畫面」

### Android
1. 用 Chrome 打開網址
2. 點右上角選單 →「新增至主畫面」或「安裝應用程式」

### Mac / Windows
1. 用 Chrome 打開網址
2. 網址列右側會出現安裝圖示，點擊即可

---

## Gemini AI 設定

1. 前往 [aistudio.google.com](https://aistudio.google.com)
2. 登入 Google 帳號
3. 點「Get API Key」→「Create API Key」
4. 在 APP 內「收支」頁面右上角 ⚙ → 設定 Gemini API Key

免費額度：每天 1500 次，個人使用完全夠

---

## 功能說明

| 功能 | 說明 |
|------|------|
| 總覽 | 本月消費、預算使用、資產概況、最近記錄 |
| 信用卡 | 多卡管理，各卡消費/分期/訂閱分開追蹤 |
| 訂閱 | 固定訂閱管理，年度試算 |
| AI 助理 | 財務分析、專屬財務師對話、掃描帳單匯入 |
| 每月收支 | 未來6個月固定支出預測，⚙設定入口 |

---

## 技術架構

- **前端**：React + Vite + Recharts
- **後端**：Supabase（PostgreSQL + Auth）
- **PWA**：vite-plugin-pwa（Service Worker + Manifest）
- **AI**：Google Gemini 2.0 Flash API
- **部署**：Vercel / Netlify

---

## 資料安全

- 所有資料透過 Supabase Row Level Security 保護，每個用戶只能存取自己的資料
- Gemini API Key 儲存在你自己的 Supabase，不會傳給任何第三方
- 原始碼完全開放，可自行檢查
