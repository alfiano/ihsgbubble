# Rencana Web App Visualisasi Kenaikan Harga Saham IHSG (Bubble Chart)

## 1. Arsitektur

- **Backend API**: Python (Flask/FastAPI)
  - Endpoint: `/api/bubbles`
  - Fungsi: Ambil harga penutupan hari ini & kemarin untuk semua ticker, hitung persentase kenaikan, return data JSON.
- **Frontend**: HTML + JavaScript
  - Fetch data dari endpoint API.
  - Render bubble chart (pakai D3.js atau Chart.js Bubble).
  - Interaktif: hover/click untuk info detail.

## 2. Alur Data

1. User membuka web app.
2. Frontend fetch data dari `/api/bubbles`.
3. Data berisi: ticker, close_today, close_yesterday, change_pct.
4. Frontend render bubble chart:
   - Ukuran bubble = besar kenaikan harga (persentase).
   - Warna: hijau (naik), merah (turun).
   - Hover/click: info detail saham.

## 3. Diagram Arsitektur

```mermaid
flowchart TD
    A[CSV Ticker List] --> B[Backend API (Python)]
    B -->|/api/bubbles| C[Frontend HTML+JS]
    C --> D[User: Interaktif Bubble Chart]
```

## 4. Contoh Data Output API

```json
[
  {"ticker": "BBCA.JK", "close_today": 10000, "close_yesterday": 9800, "change_pct": 2.04},
  {"ticker": "TLKM.JK", "close_today": 4200, "close_yesterday": 4100, "change_pct": 2.44}
]
```

## 5. Langkah Implementasi

1. **Backend API**
   - Python Flask/FastAPI.
   - Endpoint `/api/bubbles`:
     - Baca file CSV ticker.
     - Ambil harga penutupan hari ini & kemarin via yfinance.
     - Hitung persentase kenaikan.
     - Return JSON.

2. **Frontend**
   - HTML + JS.
   - Fetch data dari API.
   - Render bubble chart (D3.js/Chart.js).
   - Interaktif: hover/click info.

## 6. Catatan

- Backend bisa dijalankan terpisah, frontend cukup file statis.
- Data selalu update saat endpoint diakses.
- Bisa dikembangkan lebih lanjut (filter, search, dsb).

---