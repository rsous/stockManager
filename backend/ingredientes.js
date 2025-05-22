'use strict';

const sqlite3 = require('sqlite3').verbose();

exports.handler = async (event, context) => {
  const db = new sqlite3.Database('./data/estoque.db');
  
  try {
    if (event.httpMethod === 'GET') {
      const rows = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM ingredientes', [], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
      return { statusCode: 200, body: JSON.stringify(rows) };
    }

    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const { nome, quantidade, unidade, quantidade_minima } = data;
      
      const id = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO ingredientes (nome, quantidade, unidade, quantidade_minima) VALUES (?, ?, ?, ?)',
          [nome, quantidade, unidade, quantidade_minima],
          function(err) {
            if (err) reject(err);
            resolve(this.lastID);
          }
        );
      });
      
      return { statusCode: 200, body: JSON.stringify({ id }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    return { statusCode: 500, body: err.toString() };
  } finally {
    db.close();
  }
};