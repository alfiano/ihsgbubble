import pandas as pd
import yfinance as yf

# Baca file CSV daftar ticker (tanpa header)
csv_path = "ticker saham ihsg.csv"
df = pd.read_csv(csv_path, header=None, names=["Kode"])

# Tambahkan akhiran .JK untuk setiap kode saham
tickers = [f"{kode.strip()}.JK" for kode in df["Kode"] if pd.notnull(kode)]

# Ambil harga penutupan hari ini untuk semua ticker
close_prices = {}
for ticker in tickers:
    try:
        data = yf.Ticker(ticker).history(period="1d")
        if not data.empty:
            close_prices[ticker] = data["Close"].iloc[0]
        else:
            close_prices[ticker] = None
    except Exception as e:
        close_prices[ticker] = None

# Buat DataFrame hasil
result_df = pd.DataFrame(list(close_prices.items()), columns=["Ticker", "Close_Price"])

# Simpan ke CSV
result_df.to_csv("harga_penutupan.csv", index=False)

# Print hasil ke layar
print(result_df)
