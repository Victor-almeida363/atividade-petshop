const mysql = require('mysql2/promise');

// Configuração via variáveis de ambiente (veja .env.example / README).
// Nunca grave a senha do banco direto no código.
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'petshop', // mesmo nome criado pelo petshop.sql
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

module.exports = db;
