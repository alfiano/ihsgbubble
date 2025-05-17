const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// Konfigurasi koneksi MySQL (sama dengan yang digunakan di api.js)
const dbConfig = {
  host: 'localhost',
  user: 'root', // Ganti dengan user MySQL Anda
  password: '', // Ganti dengan password MySQL Anda
  database: 'ihsgbubble' // Nama database yang sudah dibuat user
};

const LQ45_CSV_PATH = path.join(__dirname, 'lq45.csv');

async function getLQ45TickersFromCsv(csvPath) {
  try {
    const data = await fs.readFile(csvPath, 'utf8');
    // Asumsi CSV hanya satu kolom ticker per baris
    const tickers = data.split(/\r?\n/) // Handle both Windows (CRLF) and Unix (LF) line endings
      .map(line => line.trim())
      .filter(line => line !== '');
    
    console.log(`Found ${tickers.length} LQ45 tickers in CSV file`);
    return tickers;
  } catch (error) {
    console.error("Error reading LQ45 CSV file:", error);
    return [];
  }
}

async function updateLQ45Column() {
  let connection;
  try {
    // Baca daftar saham LQ45 dari file CSV
    const lq45Tickers = await getLQ45TickersFromCsv(LQ45_CSV_PATH);
    if (lq45Tickers.length === 0) {
      console.log("No LQ45 tickers found in CSV.");
      return;
    }

    // Koneksi ke database
    console.log("Connecting to MySQL database...");
    connection = await mysql.createConnection(dbConfig);
    console.log("Connected to MySQL database.");

    // Cek apakah kolom lq45 sudah ada di tabel stock_price
    const [columns] = await connection.execute("SHOW COLUMNS FROM stock_price LIKE 'lq45'");
    
    // Jika kolom belum ada, tambahkan kolom baru
    if (columns.length === 0) {
      console.log("Adding lq45 column to stock_price table...");
      await connection.execute("ALTER TABLE stock_price ADD COLUMN lq45 TINYINT(1) DEFAULT 0");
      console.log("Column lq45 added successfully.");
    } else {
      console.log("Column lq45 already exists in stock_price table.");
    }

    // Reset semua nilai lq45 menjadi 0 (false)
    console.log("Resetting all lq45 values to 0...");
    await connection.execute("UPDATE stock_price SET lq45 = 0");
    console.log("All lq45 values reset to 0.");

    // Update nilai lq45 menjadi 1 (true) untuk saham yang ada di daftar LQ45
    console.log("Updating lq45 values for LQ45 stocks...");
    for (const ticker of lq45Tickers) {
      // Tambahkan .JK ke ticker karena di database menggunakan format ini
      const tickerForDb = `${ticker}.JK`;
      
      // Update semua record untuk ticker ini
      const [result] = await connection.execute(
        "UPDATE stock_price SET lq45 = 1 WHERE ticker = ?",
        [tickerForDb]
      );
      
      console.log(`Updated ${result.affectedRows} rows for ticker ${tickerForDb}`);
    }

    console.log("LQ45 column update completed successfully.");

  } catch (err) {
    console.error("Database or script error:", err);
  } finally {
    if (connection) {
      await connection.end();
      console.log("MySQL connection closed.");
    }
  }
}

// Jalankan fungsi update
updateLQ45Column();
