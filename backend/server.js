'use strict';

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();

// Configuração básica
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Teste de conexão
pool.query('SELECT NOW()')
  .then(() => console.log('Conectado ao PostgreSQL com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao PostgreSQL:', err));

// Rotas da API
// GET todos os ingredientes
app.get('/api/ingredientes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ingredientes ORDER BY nome');
    res.json(rows);
  } catch (err) {
    console.error('Erro no PostgreSQL:', err);
    res.status(500).json({ error: 'Erro ao buscar ingredientes' });
  }
});

// GET um ingrediente específico
app.get('/api/ingredientes/:id', async (req, res) => {
  const ingredientId = parseInt(req.params.id);
  
  // Validação do ID
  if (isNaN(ingredientId) || ingredientId <= 0) {
    return res.status(400).json({ 
      error: 'ID inválido',
      message: 'O ID deve ser um número positivo'
    });
  }

  try {
    const queryText = `
      SELECT 
        id, nome, quantidade, unidade, 
        quantidade_minima, validade, fornecedor,
        TO_CHAR(ultima_atualizacao, 'YYYY-MM-DD HH24:MI:SS') as ultima_atualizacao
      FROM ingredientes 
      WHERE id = $1
    `;
    
    const { rows } = await pool.query(queryText, [ingredientId]);

    if (rows.length === 0) {
      return res.status(404).json({ 
        error: 'Não encontrado',
        message: `Nenhum ingrediente encontrado com o ID ${ingredientId}`
      });
    }

    // Formata a resposta
    const ingrediente = {
      ...rows[0],
      // Adiciona links HATEOAS (opcional)
      _links: {
        self: `/api/ingredientes/${ingredientId}`,
        all: '/api/ingredientes'
      }
    };

    res.json(ingrediente);
  } catch (err) {
    console.error(`Erro ao buscar ingrediente ${ingredientId}:`, err);
    
    res.status(500).json({
      error: 'Erro no banco de dados',
      requestId: req.id, // Requer middleware para gerar IDs de requisição
      timestamp: new Date().toISOString()
    });
  }
});

// POST novo ingrediente
app.post('/api/ingredientes', async (req, res) => {
  const { nome, quantidade, unidade, quantidade_minima, validade, fornecedor } = req.body;
  
  try {
    const { rows } = await pool.query(
      `INSERT INTO ingredientes 
       (nome, quantidade, unidade, quantidade_minima, validade, fornecedor) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [nome, quantidade, unidade, quantidade_minima, validade, fornecedor]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro no PostgreSQL:', err);
    res.status(500).json({ error: 'Erro ao adicionar ingrediente' });
  }
});

// PUT atualizar ingrediente
app.put('/api/ingredientes/:id', async (req, res) => {
  const { quantidade } = req.body;
  
  try {
    const { rowCount } = await pool.query(
      'UPDATE ingredientes SET quantidade = $1 WHERE id = $2',
      [quantidade, req.params.id]
    );
    
    res.json({ 
      updated: rowCount > 0,
      message: rowCount > 0 ? 'Quantidade atualizada' : 'Nenhum registro alterado' 
    });
  } catch (err) {
    console.error('Erro no PostgreSQL:', err);
    res.status(500).json({ error: 'Erro ao atualizar quantidade' });
  }
});

// DELETE ingrediente
app.delete('/api/ingredientes/:id', async (req, res) => {
  const ingredientId = parseInt(req.params.id);

  // Validação do ID
  if (isNaN(ingredientId)) {
    return res.status(400).json({ 
      error: 'ID inválido',
      message: 'O ID deve ser um número'
    });
  }

  try {
    // Verifica se o ingrediente existe antes de deletar
    const checkResult = await pool.query(
      'SELECT id FROM ingredientes WHERE id = $1',
      [ingredientId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Não encontrado',
        message: `Nenhum ingrediente encontrado com o ID ${ingredientId}`
      });
    }

    // Executa a exclusão
    const deleteResult = await pool.query(
      'DELETE FROM ingredientes WHERE id = $1 RETURNING *',
      [ingredientId]
    );

    res.json({
      success: true,
      deletedIngredient: deleteResult.rows[0],
      message: 'Ingrediente removido com sucesso'
    });

  } catch (err) {
    console.error(`Erro ao excluir ingrediente ${ingredientId}:`, err);
    
    // Tratamento especial para erros de FK (se houver relacionamentos)
    if (err.code === '23503') { // Código de erro de FK constraint
      return res.status(409).json({
        error: 'Conflito',
        message: 'Este ingrediente não pode ser removido pois está em uso'
      });
    }

    res.status(500).json({
      error: 'Erro no servidor',
      requestId: req.id, // Requer middleware para gerar IDs de requisição
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para o frontend


// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});