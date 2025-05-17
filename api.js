const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3030; // Gunakan port dari environment variable atau default 3030

// Konfigurasi koneksi MySQL
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root', // Ganti dengan user MySQL Anda
  password: '', // Ganti dengan password MySQL Anda
  database: 'ihsgbubble' // Nama database yang sudah dibuat user
};

// Middleware untuk serve file statis dari folder 'static'
app.use(express.static(path.join(__dirname, 'static')));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Endpoint: GET /api/bubbles?date=YYYY-MM-DD
// Jika date tidak diberikan, ambil data untuk tanggal terbaru di database
app.get('/api/bubbles', async (req, res) => {
  let connection;
  try {
    console.log('Connecting to MySQL database on port 3306...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Successfully connected to MySQL');

    let targetDate = req.query.date;

    // Jika tanggal tidak diberikan, gunakan tanggal hari ini dalam zona waktu Jakarta (UTC+7)
    if (!targetDate) {
      // Buat objek Date dengan waktu saat ini
      const now = new Date();
      
      // Konversi ke zona waktu Jakarta (UTC+7)
      // Tambahkan offset 7 jam dari UTC
      const jakartaTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      
      // Format tanggal YYYY-MM-DD untuk Jakarta
      const year = jakartaTime.getUTCFullYear();
      const month = String(jakartaTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(jakartaTime.getUTCDate()).padStart(2, '0');
      targetDate = `${year}-${month}-${day}`;
      
      console.log(`Using Jakarta date (UTC+7): ${targetDate}`);
    } else {
      // Validasi format tanggal sederhana YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
         return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
      }
       console.log(`Using specified date: ${targetDate}`);
    }


    // Ambil harga penutupan hari ini (targetDate) beserta yesterday_close_price
    let foundRows = [];
    let searchDate = targetDate;
    let attempts = 0;
    const maxAttempts = 30; // Limit to 30 days back to avoid infinite loop
    while (attempts < maxAttempts) {
      const [rows] = await connection.execute(
        'SELECT ticker, close_price, yesterday_close_price, lq45, issi FROM `stock_price` WHERE close_date = ?', [searchDate]
      );
      if (rows.length > 0) {
        foundRows = rows;
        if (searchDate !== targetDate) {
          console.log(`No data found for requested date, using previous date: ${searchDate}`);
        }
        break;
      }
      // Decrement date by one day
      const d = new Date(searchDate);
      d.setDate(d.getDate() - 1);
      searchDate = d.toISOString().slice(0, 10);
      attempts++;
    }
    if (foundRows.length === 0) {
      console.log(`No data found for any date within ${maxAttempts} days before ${targetDate}`);
      return res.status(404).json({ error: `No data found for any date within ${maxAttempts} days before ${targetDate}.` });
    }
    // Use foundRows and searchDate for further processing
    const todayRows = foundRows;
    targetDate = searchDate;

    // Untuk backward compatibility, jika yesterday_close_price tidak ada, ambil dari hari sebelumnya
    const needYesterdayPrices = todayRows.some(row => row.yesterday_close_price === null);
    let yesterdayMap = {};
    
    if (needYesterdayPrices) {
      console.log('Some rows missing yesterday_close_price, fetching from previous day...');
      const [yesterdayRows] = await connection.execute(
        'SELECT ticker, close_price FROM `stock_price` WHERE close_date = DATE_SUB(?, INTERVAL 1 DAY)', [targetDate]
      );
      
      // Buat map ticker -> harga kemarin
      for (const row of yesterdayRows) {
        yesterdayMap[row.ticker] = row.close_price;
      }
    }

    // Gabungkan data dan hitung persentase kenaikan
    const result = todayRows.map(row => {
      // Prioritaskan yesterday_close_price, jika tidak ada gunakan data dari hari sebelumnya
      const yesterdayPrice = row.yesterday_close_price !== null ? 
        row.yesterday_close_price : 
        yesterdayMap[row.ticker];
      
      const changePct = (yesterdayPrice !== undefined && yesterdayPrice !== null && 
                          row.close_price !== null && yesterdayPrice !== 0)
        ? ((row.close_price - yesterdayPrice) / yesterdayPrice) * 100
        : null; // Handle kasus jika harga kemarin tidak ada atau nol

      return {
        ticker: row.ticker,
        close_today: row.close_price,
        yesterday_close_price: row.yesterday_close_price,
        close_yesterday: yesterdayPrice, // Untuk backward compatibility
        change_pct: changePct,
        lq45: row.lq45 === 1, // Include LQ45 status as boolean
        issi: row.issi === 1  // Include ISSI status as boolean
      };
    });

    res.json(result);

  } catch (err) {
    console.error("API Error:", err.message);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) {
      await connection.end();
      console.log("MySQL connection closed.");
    }
  }
});

// Fallback handler for when database connection fails
app.get('/api/bubbles-mock', (req, res) => {
  console.log('Serving mock data');
  // Return mock data for testing with yesterday_close_price
  const mockData = [
    // Bank stocks
    { ticker: 'BBCA', close_today: 9250, yesterday_close_price: 9000, close_yesterday: 9000, change_pct: 2.78, lq45: true, issi: false },
    { ticker: 'BBRI', close_today: 4350, yesterday_close_price: 4500, close_yesterday: 4500, change_pct: -3.33, lq45: true, issi: false },
    { ticker: 'BMRI', close_today: 6100, yesterday_close_price: 5950, close_yesterday: 5950, change_pct: 2.52, lq45: true, issi: false },
    { ticker: 'BBNI', close_today: 4800, yesterday_close_price: 4700, close_yesterday: 4700, change_pct: 2.13, lq45: true, issi: false },
    
    // Telco stocks
    { ticker: 'TLKM', close_today: 3950, yesterday_close_price: 3800, close_yesterday: 3800, change_pct: 3.95, lq45: true, issi: true },
    { ticker: 'EXCL', close_today: 2100, yesterday_close_price: 2200, close_yesterday: 2200, change_pct: -4.55, lq45: true, issi: false },
    
    // Consumer goods
    { ticker: 'UNVR', close_today: 4200, yesterday_close_price: 4300, close_yesterday: 4300, change_pct: -2.33, lq45: true, issi: false },
    { ticker: 'ICBP', close_today: 8800, yesterday_close_price: 8500, close_yesterday: 8500, change_pct: 3.53, lq45: true, issi: true },
    
    // Mining & Energy
    { ticker: 'PGAS', close_today: 1650, yesterday_close_price: 1600, close_yesterday: 1600, change_pct: 3.13, lq45: true, issi: true },
    { ticker: 'PTBA', close_today: 2300, yesterday_close_price: 2400, close_yesterday: 2400, change_pct: -4.17, lq45: true, issi: true },
    { ticker: 'ADRO', close_today: 2550, yesterday_close_price: 2650, close_yesterday: 2650, change_pct: -3.77, lq45: true, issi: true },
    { ticker: 'ANTM', close_today: 1950, yesterday_close_price: 1900, close_yesterday: 1900, change_pct: 2.63, lq45: true, issi: true },
    
    // Property
    { ticker: 'BSDE', close_today: 1250, yesterday_close_price: 1300, close_yesterday: 1300, change_pct: -3.85, lq45: false, issi: true },
    { ticker: 'PWON', close_today: 520, yesterday_close_price: 505, close_yesterday: 505, change_pct: 2.97, lq45: false, issi: true },
    
    // Tech
    { ticker: 'GOTO', close_today: 85, yesterday_close_price: 80, close_yesterday: 80, change_pct: 6.25, lq45: true, issi: false },
    { ticker: 'BUKA', close_today: 180, yesterday_close_price: 195, close_yesterday: 195, change_pct: -7.69, lq45: false, issi: false }
  ];
  res.json(mockData);
});

// Serve index.html untuk root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// Handle favicon.ico request
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // Return No Content status to stop browser from repeatedly requesting favicon
});

// Handle 404 errors
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found', path: req.url });
});

app.listen(PORT, () => {
  console.log(`Node.js API server running at http://localhost:${PORT}`);
  console.log(`API endpoints available:`);
  console.log(`- GET /api/bubbles - Get real data from database`);
  console.log(`- GET /api/bubbles-mock - Get mock data for testing`);
});