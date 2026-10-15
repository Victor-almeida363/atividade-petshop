const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function erroServidor(res, erro) {
  console.error(erro);
  return res.status(500).json({ erro: 'Ocorreu um erro interno. Confira o terminal do servidor.' });
}

// ---------- Helpers de validação ----------
const texto = v => (v === null || v === undefined ? '' : String(v)).trim();

function cpfValido(cpf) {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(n[i]) * (t + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(n[t])) return false;
  }
  return true;
}
const formatarCpf = cpf => cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

const pad = n => String(n).padStart(2, '0');
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dataValida(iso) { // YYYY-MM-DD real
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d;
}
// aceita "YYYY-MM-DDTHH:mm" ou "YYYY-MM-DD HH:mm[:ss]" e devolve "YYYY-MM-DD HH:mm:ss" (ou null)
function normalizarDataHora(v) {
  const m = texto(v).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m || !dataValida(m[1]) || +m[2] > 23 || +m[3] > 59) return null;
  return `${m[1]} ${m[2]}:${m[3]}:${m[4] || '00'}`;
}
function numeroNoIntervalo(v, max, casas) {
  if (v === null || v === undefined || v === '') return { valor: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) return { erro: true };
  return { valor: Number(n.toFixed(casas)) };
}
const ESPECIES = ['Cachorro', 'Gato', 'Ave', 'Roedor', 'Réptil', 'Outra'];

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// CLIENTES / TUTORES
app.get('/clientes', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM cliente ORDER BY nome');
    res.json(rows);
  } catch (e) { erroServidor(res, e); }
});

app.post('/clientes', async (req, res) => {
  try {
    const nome = texto(req.body.nome), cpf = texto(req.body.cpf);
    const telefone = texto(req.body.telefone), endereco = texto(req.body.endereco);
    if (!nome || !cpf) return res.status(400).json({ erro: 'Nome e CPF são obrigatórios.' });
    if (nome.length > 100 || telefone.length > 20 || endereco.length > 200) {
      return res.status(400).json({ erro: 'Algum campo excede o tamanho permitido.' });
    }
    if (!cpfValido(cpf)) return res.status(400).json({ erro: 'CPF inválido.' });
    const [result] = await db.query(
      'INSERT INTO cliente (nome, cpf, telefone, endereco) VALUES (?, ?, ?, ?)',
      [nome, formatarCpf(cpf), telefone, endereco]
    );
    res.status(201).json({ mensagem: 'Tutor cadastrado com sucesso!', id: result.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Este CPF já está cadastrado.' });
    erroServidor(res, e);
  }
});

app.delete('/clientes/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id FROM animal WHERE cliente_id = ? LIMIT 1', [req.params.id]);
    if (rows.length) return res.status(400).json({ erro: 'Este tutor possui animais e não pode ser excluído.' });
    const [result] = await db.query('DELETE FROM cliente WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ erro: 'Tutor não encontrado.' });
    res.json({ mensagem: 'Tutor excluído com sucesso.' });
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2') return res.status(400).json({ erro: 'Este tutor possui registros vinculados e não pode ser excluído.' });
    erroServidor(res, e);
  }
});

// ANIMAIS
app.get('/animais', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.id, a.nome, a.especie, a.raca, a.data_nascimento, a.cliente_id,
             c.nome AS tutor
      FROM animal a JOIN cliente c ON c.id = a.cliente_id
      ORDER BY a.nome`);
    res.json(rows);
  } catch (e) { erroServidor(res, e); }
});

app.post('/animais', async (req, res) => {
  try {
    const nome = texto(req.body.nome), especie = texto(req.body.especie), raca = texto(req.body.raca);
    const data_nascimento = texto(req.body.data_nascimento) || null;
    const cliente_id = Number(req.body.cliente_id);
    if (!nome || !cliente_id) return res.status(400).json({ erro: 'Nome do animal e tutor são obrigatórios.' });
    if (!ESPECIES.includes(especie)) return res.status(400).json({ erro: 'Selecione uma espécie válida.' });
    if (nome.length > 100 || raca.length > 80) return res.status(400).json({ erro: 'Algum campo excede o tamanho permitido.' });
    if (data_nascimento && (!dataValida(data_nascimento) || data_nascimento > hojeISO())) {
      return res.status(400).json({ erro: 'Data de nascimento inválida ou no futuro.' });
    }
    const [tutor] = await db.query('SELECT id FROM cliente WHERE id = ?', [cliente_id]);
    if (!tutor.length) return res.status(400).json({ erro: 'O tutor selecionado não existe.' });
    const [result] = await db.query(
      'INSERT INTO animal (nome, especie, raca, data_nascimento, cliente_id) VALUES (?, ?, ?, ?, ?)',
      [nome, especie, raca, data_nascimento, cliente_id]
    );
    res.status(201).json({ mensagem: 'Animal cadastrado com sucesso!', id: result.insertId });
  } catch (e) { erroServidor(res, e); }
});

app.delete('/animais/:id', async (req, res) => {
  try {
    const [avaliacoes] = await db.query('SELECT id FROM avaliacao WHERE animal_id = ? LIMIT 1', [req.params.id]);
    if (avaliacoes.length) return res.status(400).json({ erro: 'Este animal possui avaliações. Exclua as avaliações antes.' });
    const [agendamentos] = await db.query('SELECT id FROM agendamento WHERE animal_id = ? LIMIT 1', [req.params.id]);
    if (agendamentos.length) return res.status(400).json({ erro: 'Este animal possui agendamentos. Cancele/remova os agendamentos antes.' });
    const [result] = await db.query('DELETE FROM animal WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ erro: 'Animal não encontrado.' });
    res.json({ mensagem: 'Animal excluído com sucesso.' });
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2') return res.status(400).json({ erro: 'Este animal possui registros vinculados e não pode ser excluído.' });
    erroServidor(res, e);
  }
});

// VETERINÁRIOS
app.get('/veterinarios', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nome, crm FROM veterinario ORDER BY nome');
    res.json(rows);
  } catch (e) { erroServidor(res, e); }
});

// AVALIAÇÕES
app.get('/animais/:id/avaliacoes', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT av.id, av.data_avaliacao, av.peso, av.temperatura, av.diagnostico,
             av.recomendacoes, av.animal_id, av.veterinario_id, v.nome AS veterinario
      FROM avaliacao av JOIN veterinario v ON v.id = av.veterinario_id
      WHERE av.animal_id = ? ORDER BY av.data_avaliacao DESC, av.id DESC`, [req.params.id]);
    res.json(rows);
  } catch (e) { erroServidor(res, e); }
});

app.post('/avaliacoes', async (req, res) => {
  try {
    const data_avaliacao = texto(req.body.data_avaliacao), diagnostico = texto(req.body.diagnostico);
    const recomendacoes = texto(req.body.recomendacoes);
    const animal_id = Number(req.body.animal_id), veterinario_id = Number(req.body.veterinario_id);
    if (!data_avaliacao || !diagnostico || !animal_id || !veterinario_id) {
      return res.status(400).json({ erro: 'Data, diagnóstico, animal e veterinário são obrigatórios.' });
    }
    if (!dataValida(data_avaliacao) || data_avaliacao > hojeISO()) {
      return res.status(400).json({ erro: 'Data da avaliação inválida ou no futuro.' });
    }
    const peso = numeroNoIntervalo(req.body.peso, 999.99, 2);
    if (peso.erro) return res.status(400).json({ erro: 'Peso inválido (use um valor entre 0 e 999,99 kg).' });
    const temp = numeroNoIntervalo(req.body.temperatura, 99.9, 1);
    if (temp.erro) return res.status(400).json({ erro: 'Temperatura inválida (use um valor entre 0 e 99,9 °C).' });
    const [an] = await db.query('SELECT id FROM animal WHERE id = ?', [animal_id]);
    if (!an.length) return res.status(400).json({ erro: 'O animal selecionado não existe.' });
    const [vt] = await db.query('SELECT id FROM veterinario WHERE id = ?', [veterinario_id]);
    if (!vt.length) return res.status(400).json({ erro: 'O veterinário selecionado não existe.' });
    const [result] = await db.query(
      `INSERT INTO avaliacao (data_avaliacao, peso, temperatura, diagnostico, recomendacoes, animal_id, veterinario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data_avaliacao, peso.valor, temp.valor, diagnostico, recomendacoes, animal_id, veterinario_id]
    );
    res.status(201).json({ mensagem: 'Avaliação registrada com sucesso!', id: result.insertId });
  } catch (e) { erroServidor(res, e); }
});

app.delete('/avaliacoes/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM avaliacao WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ erro: 'Avaliação não encontrada.' });
    res.json({ mensagem: 'Avaliação excluída com sucesso.' });
  } catch (e) { erroServidor(res, e); }
});

// AGENDAMENTOS (desafio)
app.get('/agendamentos', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ag.id, ag.data_hora, ag.istatus, ag.observacao, ag.leva_traz,
             an.nome AS animal, c.nome AS tutor, s.nome AS servico, s.preco
      FROM agendamento ag
      JOIN animal an ON an.id = ag.animal_id
      JOIN cliente c ON c.id = an.cliente_id
      JOIN servico s ON s.id = ag.servico_id
      ORDER BY ag.data_hora`);
    res.json(rows);
  } catch (e) { erroServidor(res, e); }
});

app.get('/servicos', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nome, preco, duracao FROM servico ORDER BY nome');
    res.json(rows);
  } catch (e) { erroServidor(res, e); }
});

app.post('/agendamentos', async (req, res) => {
  try {
    const data_hora = normalizarDataHora(req.body.data_hora);
    const animal_id = Number(req.body.animal_id), servico_id = Number(req.body.servico_id);
    const observacao = texto(req.body.observacao);
    const leva_traz = req.body.leva_traz === true || req.body.leva_traz === 'true' || req.body.leva_traz === 1;
    if (!req.body.data_hora || !animal_id || !servico_id) {
      return res.status(400).json({ erro: 'Data/hora, animal e serviço são obrigatórios.' });
    }
    if (!data_hora) return res.status(400).json({ erro: 'Data/hora inválida.' });
    if (new Date(data_hora.replace(' ', 'T')) < new Date()) {
      return res.status(400).json({ erro: 'Não é possível agendar em data/hora passada.' });
    }
    const [an] = await db.query('SELECT id FROM animal WHERE id = ?', [animal_id]);
    if (!an.length) return res.status(400).json({ erro: 'O animal selecionado não existe.' });
    const [sv] = await db.query('SELECT duracao FROM servico WHERE id = ?', [servico_id]);
    if (!sv.length) return res.status(400).json({ erro: 'O serviço selecionado não existe.' });

    // Conflito por intervalo: [início, início + duração) não pode se sobrepor a outro agendamento.
    const [conflito] = await db.query(
      `SELECT ag.id FROM agendamento ag JOIN servico s ON s.id = ag.servico_id
       WHERE ag.istatus <> 'Cancelado'
         AND ag.data_hora < DATE_ADD(?, INTERVAL ? MINUTE)
         AND DATE_ADD(ag.data_hora, INTERVAL s.duracao MINUTE) > ?
       LIMIT 1`,
      [data_hora, sv[0].duracao, data_hora]
    );
    if (conflito.length) return res.status(400).json({ erro: 'Já existe um agendamento que ocupa esse horário. Escolha outro.' });

    const [result] = await db.query(
      'INSERT INTO agendamento (data_hora, istatus, observacao, leva_traz, animal_id, servico_id) VALUES (?, ?, ?, ?, ?, ?)',
      [data_hora, 'Agendado', observacao, leva_traz, animal_id, servico_id]
    );
    res.status(201).json({ mensagem: 'Agendamento criado com sucesso!', id: result.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ erro: 'Já existe um agendamento nesse horário.' });
    erroServidor(res, e);
  }
});

app.delete('/agendamentos/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM agendamento WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    res.json({ mensagem: 'Agendamento cancelado com sucesso.' });
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2') return res.status(400).json({ erro: 'Este agendamento possui pagamento vinculado e não pode ser excluído.' });
    erroServidor(res, e);
  }
});

// JSON malformado e erros inesperados sempre respondem em JSON
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido na requisição.' });
  console.error(err);
  res.status(500).json({ erro: 'Ocorreu um erro interno.' });
});


app.listen(PORT, () => console.log(`Pet Shop Amigo Fiel disponível em http://localhost:${PORT}`));
