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

const ISSI_CSV_PATH = path.join(__dirname, 'issi.csv');

async function getISSITickersFromCsv(csvPath) {
  try {
    const data = await fs.readFile(csvPath, 'utf8');
    // Asumsi CSV hanya satu kolom ticker per baris
    const tickers = data.split(/\r?\n/) // Handle both Windows (CRLF) and Unix (LF) line endings
      .map(line => line.trim())
      .filter(line => line !== '');
    
    console.log(`Found ${tickers.length} ISSI tickers in CSV file`);
    return tickers;
  } catch (error) {
    console.error("Error reading ISSI CSV file:", error);
    return [];
  }
}

async function updateISSIColumn() {
  let connection;
  try {
    // Baca daftar saham ISSI dari file CSV
    const issiTickers = await getISSITickersFromCsv(ISSI_CSV_PATH);
    if (issiTickers.length === 0) {
      console.log("No ISSI tickers found in CSV.");
      return;
    }

    // Koneksi ke database
    console.log("Connecting to MySQL database...");
    connection = await mysql.createConnection(dbConfig);
    console.log("Connected to MySQL database.");

    // Cek apakah kolom issi sudah ada di tabel stock_price
    const [columns] = await connection.execute("SHOW COLUMNS FROM stock_price LIKE 'issi'");
    
    // Jika kolom belum ada, tambahkan kolom baru
    if (columns.length === 0) {
      console.log("Adding issi column to stock_price table...");
      await connection.execute("ALTER TABLE stock_price ADD COLUMN issi TINYINT(1) DEFAULT 0");
      console.log("Column issi added successfully.");
    } else {
      console.log("Column issi already exists in stock_price table.");
    }

    // Reset semua nilai issi menjadi 0 (false)
    console.log("Resetting all issi values to 0...");
    await connection.execute("UPDATE stock_price SET issi = 0");
    console.log("All issi values reset to 0.");

    // Update nilai issi menjadi 1 (true) untuk saham yang ada di daftar ISSI
    console.log("Updating issi values for ISSI stocks...");
    for (const ticker of issiTickers) {
      // Tambahkan .JK ke ticker karena di database menggunakan format ini
      const tickerForDb = `${ticker}.JK`;
      
      // Update semua record untuk ticker ini
      const [result] = await connection.execute(
        "UPDATE stock_price SET issi = 1 WHERE ticker = ?",
        [tickerForDb]
      );
      
      console.log(`Updated ${result.affectedRows} rows for ticker ${tickerForDb}`);
    }

    console.log("ISSI column update completed successfully.");

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
updateISSIColumn();
