from flask import Flask, jsonify, send_from_directory
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import os

app = Flask(__name__, static_folder="static")

CSV_PATH = "ticker saham ihsg.csv"

def get_bubble_data():
    df = pd.read_csv(CSV_PATH, header=None, names=["Kode"])
    tickers = [f"{kode.strip()}.JK" for kode in df["Kode"] if pd.notnull(kode)]

    results = []
    for ticker in tickers:
        try:
            # Ambil data 2 hari terakhir (agar dapat close hari ini & kemarin)
            data = yf.Ticker(ticker).history(period="2d")
            if len(data) >= 2:
                close_yesterday = data["Close"].iloc[-2]
                close_today = data["Close"].iloc[-1]
                change_pct = ((close_today - close_yesterday) / close_yesterday) * 100 if close_yesterday else None
                results.append({
                    "ticker": ticker,
                    "close_today": close_today,
                    "close_yesterday": close_yesterday,
                    "change_pct": change_pct
                })
            else:
                results.append({
                    "ticker": ticker,
                    "close_today": None,
                    "close_yesterday": None,
                    "change_pct": None
                })
        except Exception:
            results.append({
                "ticker": ticker,
                "close_today": None,
                "close_yesterday": None,
                "change_pct": None
            })
    return results

@app.route("/api/bubbles")
def api_bubbles():
    data = get_bubble_data()
    return jsonify(data)

# Serve index.html and static files
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    # Make sure index.html is in ./static/
    if not os.path.exists("static"):
        os.makedirs("static")
    if os.path.exists("index.html"):
        import shutil
        shutil.copy("index.html", os.path.join("static", "index.html"))
    app.run(debug=True)