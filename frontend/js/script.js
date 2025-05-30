'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const API_URL = "https://stockmanager-production-aa4d.up.railway.app/api";
  const form = document.getElementById('form-ingrediente');
  const tabela = document.getElementById('tabela-estoque');
  const alertasDiv = document.getElementById('alertas');
  const editarModal = new bootstrap.Modal(document.getElementById('editarModal'));

  carregarEstoque().catch(error => {
    console.error("Falha ao carregar estoque inicial:", error);
  });

  // Formulário de adição
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const ingrediente = {
      nome: document.getElementById('nome').value,
      quantidade: parseFloat(document.getElementById('quantidade').value),
      unidade: document.getElementById('unidade').value,
      quantidade_minima: parseFloat(document.getElementById('quantidade_minima').value),
      validade: document.getElementById('validade').value || null,
      fornecedor: document.getElementById('fornecedor').value || null
    };

    adicionarIngrediente(ingrediente);
  });

  async function carregarEstoque() {
    try {
      const response = await fetch(API_URL + '/ingredientes');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar estoque');
      }
  
      const ingredientes = await response.json();
      renderizarEstoque(ingredientes);
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
      alertasDiv.innerHTML = `
        <div class="alert alert-danger">
          Erro ao carregar estoque: ${error.message}
        </div>
      `;
    }
  }

  function renderizarEstoque(ingredientes) {
    console.log('Dados recebidos para renderização:', ingredientes);
    tabela.innerHTML = '';
    let alertas = [];

    ingredientes.forEach(item => {
      const tr = document.createElement('tr');
      const estoqueBaixo = parseFloat(item.quantidade) <= parseFloat(item.quantidade_minima);
      const estoqueZerado = parseFloat(item.quantidade) == 0;

      if (estoqueZerado) {
        alertas.push(`Sem estoque de ${item.nome}`);
        tr.classList.add('table-warning-critical');
      } else if (estoqueBaixo) {
        alertas.push(`Estoque baixo de ${item.nome}`);
        tr.classList.add('table-warning');
      }
      
      if (item.validade) {
        const hoje = new Date();
        const validade = new Date(item.validade);
        const diffDias = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        
        if (diffDias <= 0) {
          alertas.push(`ATENÇÃO: ${item.nome} vencido em ${validade.toLocaleDateString()}`);
          tr.classList.add('table-danger');
        } else if (diffDias <= 3) {
          alertas.push(`Validade próxima: ${item.nome} vence em ${diffDias} dia(s)`);
          tr.classList.add('table-warning');
        }
      }
      
      tr.innerHTML = `
        <td>${item.nome}</td>
        <td>${item.quantidade} ${item.unidade}</td>
        <td>${item.quantidade_minima} ${item.unidade}</td>
        <td>
          <button class="btn qtd btn-sm btn-outline-danger" data-id="${item.id}" data-change="-1">-1</button>
          <button class="btn qtd btn-sm btn-outline-success" data-id="${item.id}" data-change="1">+1</button>
          <button class="btn btn-sm btn-outline-primary btn-editar" data-id="${item.id}">Editar</button>
        </td>
      `;
      
      tabela.appendChild(tr);
    });
    
    // Exibir alertas
    if (alertas.length > 0) {
      alertasDiv.innerHTML = `
        <div class="alert alert-warning">
          <strong>Alertas:</strong><br>
          ${alertas.join('<br>')}
        </div>
      `;
    } else {
      alertasDiv.innerHTML = '';
    }

    const buttons = document.querySelectorAll('.btn.qtd');

    buttons.forEach(button => {
      button.addEventListener('click', async function() {
        const id = this.getAttribute('data-id');
        const change = parseFloat(this.getAttribute('data-change'));
        const currentQty = parseFloat(this.closest('tr').querySelector('td:nth-child(2)').textContent.split(' ')[0]);
        const novaQuantidade = currentQty + change;
        
        if (novaQuantidade < 0) return;

        atualizarQuantidade(id, novaQuantidade);
      });
    });
  }

  async function adicionarIngrediente(ingrediente) {
    try {
      const response = await fetch(API_URL + '/ingredientes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ingrediente)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao adicionar ingrediente');
      }

      const data = await response.json();
      console.log('Ingrediente adicionado:', data);
      form.reset();
      await carregarEstoque();
    } catch (error) {
      console.error('Erro:', error);
      alert(`Erro: ${error.message}`);
    }
  }

  async function atualizarQuantidade(id, novaQuantidade) {
    try {
      const response = await fetch(`${API_URL}/ingredientes/${id}/quantidade`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade: novaQuantidade })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar quantidade');
      }

      carregarEstoque();

      return await response.json();
    } catch (error) {
      console.error('Erro:', error);
      throw error;
    }
  }

  document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('btn-editar')) {
    const id = e.target.getAttribute('data-id');
    await abrirModalEdicao(id);
  }
  });

  function formatarParaInputDate(dataString) {
    if (!dataString) return '';
    
    const dataISO = dataString.split('.')[0];
    const data = new Date(dataISO);
    
    if (isNaN(data.getTime())) return '';
    
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}`;
  }

  async function abrirModalEdicao(id) {
    try {
      const response = await fetch(`${API_URL}/ingredientes/${id}`);
      if (!response.ok) throw new Error('Erro ao buscar ingrediente');
      
      const ingrediente = await response.json();
      
      // Preenche o formulário
      document.getElementById('editar-id').value = ingrediente.id;
      document.getElementById('editar-nome').value = ingrediente.nome;
      document.getElementById('editar-quantidade').value = ingrediente.quantidade;
      document.getElementById('editar-unidade').value = ingrediente.unidade;
      document.getElementById('editar-quantidade_minima').value = ingrediente.quantidade_minima;
      document.getElementById('editar-validade').value = formatarParaInputDate(ingrediente.validade);
      document.getElementById('editar-fornecedor').value = ingrediente.fornecedor || '';
      
      editarModal.show();
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao carregar dados para edição');
    }
  }

  document.getElementById('salvar-edicao').addEventListener('click', async () => {
    const ingrediente = {
      id: document.getElementById('editar-id').value,
      nome: document.getElementById('editar-nome').value,
      quantidade: parseFloat(document.getElementById('editar-quantidade').value),
      unidade: document.getElementById('editar-unidade').value,
      quantidade_minima: parseFloat(document.getElementById('editar-quantidade_minima').value),
      validade: document.getElementById('editar-validade').value || null,
      fornecedor: document.getElementById('editar-fornecedor').value || null
    };

    try {
      const response = await fetch(`${API_URL}/ingredientes/${ingrediente.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ingrediente)
      });

      if (!response.ok) throw new Error('Erro ao atualizar ingrediente');

      editarModal.hide();
      await carregarEstoque();
      alert('Ingrediente atualizado com sucesso!');
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao atualizar ingrediente');
    }
  });
});

