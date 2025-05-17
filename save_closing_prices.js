const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const yahooFinance = require('yahoo-finance2').default; // Menggunakan yahoo-finance2 dengan .default

// Konfigurasi koneksi MySQL
const dbConfig = {
  host: 'localhost',
  user: 'root', // Ganti dengan user MySQL Anda
  password: '', // Ganti dengan password MySQL Anda
  database: 'ihsgbubble' // Nama database yang sudah dibuat user
};

const CSV_PATH = path.join(__dirname, 'ticker saham ihsg.csv');

async function getTickersFromCsv(csvPath) {
  try {
    const data = await fs.readFile(csvPath, 'utf8');
    // Asumsi CSV hanya satu kolom ticker per baris
    const tickers = data.split(/\r?\n/) // Handle both Windows (CRLF) and Unix (LF) line endings
      .map(line => line.trim())
      .filter(line => line !== '')
      .map(ticker => `${ticker}.JK`); // Tambahkan .JK
    
    console.log(`Found ${tickers.length} tickers in CSV file`);
    return tickers;
  } catch (error) {
    console.error("Error reading CSV file:", error);
    return [];
  }
}

async function saveClosingPrices() {
  let connection;
  try {
    const tickers = await getTickersFromCsv(CSV_PATH);
    if (tickers.length === 0) {
      console.log("No tickers found in CSV.");
      return;
    }

    connection = await mysql.createConnection(dbConfig);
    console.log("Connected to MySQL database.");

    // Buat objek Date dengan waktu saat ini
    const today = new Date();
    
    // Konversi ke zona waktu Jakarta (UTC+7)
    // Tambahkan offset 7 jam dari UTC
    const jakartaToday = new Date(today.getTime() + (7 * 60 * 60 * 1000));
    
    // Format tanggal YYYY-MM-DD untuk Jakarta
    const year = jakartaToday.getUTCFullYear();
    const month = String(jakartaToday.getUTCMonth() + 1).padStart(2, '0');
    const day = String(jakartaToday.getUTCDate()).padStart(2, '0');
    const closeDate = `${year}-${month}-${day}`;
    
    // Hitung tanggal kemarin (juga dalam zona waktu Jakarta)
    const jakartaYesterday = new Date(jakartaToday);
    jakartaYesterday.setUTCDate(jakartaYesterday.getUTCDate() - 1);
    const yesterdayYear = jakartaYesterday.getUTCFullYear();
    const yesterdayMonth = String(jakartaYesterday.getUTCMonth() + 1).padStart(2, '0');
    const yesterdayDay = String(jakartaYesterday.getUTCDate()).padStart(2, '0');
    const yesterdayDate = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
    
    console.log(`Using Jakarta date (UTC+7): Today=${closeDate}, Yesterday=${yesterdayDate}`);
    
    // Untuk Yahoo Finance, kita perlu objek Date
    // Kita akan mengambil data untuk 7 hari terakhir untuk memastikan mendapatkan data kemarin
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7); // Ambil data 7 hari terakhir
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 1); // Tambahkan satu hari untuk memastikan data hari ini termasuk

    console.log(`Fetching and saving closing prices for ${closeDate} and previous day ${yesterdayDate}...`);

    for (const ticker of tickers) {
      try {
        // Ambil data historis untuk hari ini menggunakan chart API
        const queryOptions = {
          period1: startDate, // Tanggal mulai sebagai objek Date
          period2: endDate, // Tanggal akhir sebagai objek Date
          interval: '1d',
          includePrePost: false
        };
        
        console.log(`Fetching data for ${ticker}...`);
        const result = await yahooFinance.chart(ticker, queryOptions);

        if (result && result.quotes && result.quotes.length > 0) {
          // Sort quotes by date (most recent first) if they have valid dates
          const validQuotes = [];
          
          for (const quote of result.quotes) {
            if (quote && quote.date) {
              validQuotes.push(quote);
            }
          }
          
          // Sort by date (most recent first)
          validQuotes.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA; // Descending order (newest first)
          });
          
          // Jika tidak ada quotes yang valid, gunakan pendekatan alternatif
          if (validQuotes.length === 0) {
            console.log(`No valid quotes with dates found for ${ticker}, using raw data`);
            // Gunakan data mentah dan asumsikan sudah diurutkan (terbaru di akhir)
            validQuotes.push(...result.quotes);
          }
          
          // Ambil data terbaru untuk hari ini
          const todayData = validQuotes.length > 0 ? validQuotes[0] : null;
          // Ambil data kedua terbaru untuk kemarin
          const yesterdayData = validQuotes.length > 1 ? validQuotes[1] : null;
          
          const closePrice = todayData && todayData.close !== undefined ? todayData.close : null;
          const yesterdayClosePrice = yesterdayData && yesterdayData.close !== undefined ? yesterdayData.close : null;
          
          console.log(`${ticker} - Today's price: ${closePrice}, Yesterday's price: ${yesterdayClosePrice}`);
          
          // Cek apakah data untuk ticker dan tanggal ini sudah ada
          const [existingRows] = await connection.execute(
            'SELECT id FROM `stock_price` WHERE ticker = ? AND close_date = ?',
            [ticker, closeDate]
          );

          if (existingRows.length === 0) {
            // Jika belum ada, insert data baru dengan harga penutupan kemarin
            await connection.execute(
              'INSERT INTO `stock_price` (ticker, close_price, close_date, yesterday_close_price) VALUES (?, ?, ?, ?)',
              [ticker, closePrice, closeDate, yesterdayClosePrice]
            );
            console.log(`Saved: ${ticker} - Today: ${closePrice}, Yesterday: ${yesterdayClosePrice}`);
          } else {
            // Update data yang sudah ada untuk menambahkan harga penutupan kemarin
            await connection.execute(
              'UPDATE `stock_price` SET close_price = ?, yesterday_close_price = ? WHERE ticker = ? AND close_date = ?',
              [closePrice, yesterdayClosePrice, ticker, closeDate]
            );
            console.log(`Updated: ${ticker} - Today: ${closePrice}, Yesterday: ${yesterdayClosePrice}`);
          }
        } else {
          console.log(`No data found for ${ticker} on ${closeDate}.`);
        }
      } catch (err) {
        console.error(`Error processing ticker ${ticker}:`, err.message);
        // Log more details for debugging
        if (err.stack) {
          console.debug(`Stack trace: ${err.stack}`);
        }
      }
    }

    console.log("Finished saving closing prices.");

  } catch (err) {
    console.error("Database or script error:", err); // Log error object penuh
  } finally {
    if (connection) {
      await connection.end();
      console.log("MySQL connection closed.");
    }
  }
}

// Untuk menjalankan script ini secara manual:
saveClosingPrices();

// Untuk penjadwalan, bisa gunakan node-cron atau cron OS
// Contoh penjadwalan setiap hari jam 16:15 WIB (sesuaikan dengan zona waktu server)
// const cron = require('node-cron');
// cron.schedule('15 9 * * *', saveClosingPrices); // 9:15 UTC = 16:15 WIB