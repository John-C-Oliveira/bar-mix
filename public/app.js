// app.js — bar-mix (versão estática + API simulada no navegador)
// Implementa interceptação de /api/* usando localStorage e a interface frontend.

/* Simulated backend: intercept fetch('/api/...') and respond with JSON from localStorage */
(function(){
  const ORIGINAL_FETCH = window.fetch.bind(window);
  const DB_KEY = 'bar-mix-db-v1';

  function nowIso(){ return new Date().toISOString(); }

  function seed(){
    return {
      users: [ { username: 'admin', password: 'admin', role: 'admin' } ],
      products: [],
      orders: [],
      nextProductId: 1,
      nextOrderId: 1
    };
  }

  function loadDB(){
    try{
      const raw = localStorage.getItem(DB_KEY);
      if(!raw){ const s = seed(); localStorage.setItem(DB_KEY, JSON.stringify(s)); return s }
      return JSON.parse(raw);
    }catch(e){ localStorage.removeItem(DB_KEY); const s = seed(); localStorage.setItem(DB_KEY, JSON.stringify(s)); return s }
  }

  function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }

  function makeToken(username){ return btoa('token:'+username); }
  function parseToken(token){ try{ const d = atob(token); if(d.startsWith('token:')) return d.slice('token:'.length); }catch(e){} return null }

  function json(body, opts={}){ const status = opts.status||200; return new Response(JSON.stringify(body), { status, headers: { 'Content-Type':'application/json' } }) }

  async function handle(req){
    const url = new URL(req.url, location.origin);
    const path = url.pathname.replace(/^\/+/,'');
    const db = loadDB();

    function authUser(){
      const h = req.headers.get('Authorization')||''; const parts = h.split(' ');
      if(parts.length===2 && parts[0]==='Bearer'){ const u = parseToken(parts[1]); return db.users.find(x=>x.username===u) || null }
      return null;
    }

    // POST /api/login
    if(path==='api/login' && req.method==='POST'){
      const b = await req.json(); const { username, password } = b||{};
      if(!username||!password) return json({ error:'username e password são obrigatórios' },{status:400});
      const user = db.users.find(u=>u.username===username && u.password===password);
      if(!user) return json({ error:'Credenciais inválidas' },{status:401});
      return json({ token: makeToken(user.username), user:{ username: user.username, role: user.role } });
    }

    // GET /api/me
    if(path==='api/me' && req.method==='GET'){
      const u = authUser(); if(!u) return json({ error:'Não autenticado' },{status:401});
      return json({ username:u.username, role:u.role });
    }

    // GET /api/waiters (admin)
    if(path==='api/waiters' && req.method==='GET'){
      const u = authUser(); if(!u || u.role!=='admin') return json({ error:'Acesso negado' },{status:403});
      return json(db.users.filter(x=>x.role==='waiter').map(w=>({ username:w.username }))); 
    }

    // POST /api/waiters (admin)
    if(path==='api/waiters' && req.method==='POST'){
      const u = authUser(); if(!u || u.role!=='admin') return json({ error:'Acesso negado' },{status:403});
      const b = await req.json(); const { username, password } = b||{}; if(!username||!password) return json({ error:'username e password são obrigatórios' },{status:400});
      if(db.users.some(x=>x.username===username)) return json({ error:'Usuário já existe' },{status:409});
      db.users.push({ username, password, role:'waiter' }); saveDB(db); return json({ username, role:'waiter' },{status:201});
    }

    // GET /api/products
    if(path==='api/products' && req.method==='GET'){
      return json(db.products||[]);
    }

    // POST /api/products (admin)
    if(path==='api/products' && req.method==='POST'){
      const u = authUser(); if(!u || u.role!=='admin') return json({ error:'Acesso negado' },{status:403});
      const b = await req.json(); const { name, cost, price } = b||{}; if(!name || cost===undefined || price===undefined) return json({ error:'name, cost e price são obrigatórios' },{status:400});
      if(db.products.some(p=>p.name===name)) return json({ error:'Produto já existe' },{status:409});
      const id = db.nextProductId || 1; const p = { id, name, cost: Number(cost), price: Number(price) }; db.products.push(p); db.nextProductId = id+1; saveDB(db); return json(p,{status:201});
    }

    // POST /api/orders { table, waiter }
    if(path==='api/orders' && req.method==='POST'){
      const u = authUser(); if(!u) return json({ error:'Não autenticado' },{status:401});
      const b = await req.json(); const { table, waiter } = b||{}; if(!table) return json({ error:'table é obrigatório' },{status:400});
      const waiterUser = waiter || u.username; const found = db.users.find(x=>x.username===waiterUser && x.role==='waiter');
      if(!found && u.role!=='admin') return json({ error:'Garçom inválido' },{status:400});
      const id = db.nextOrderId||1; const order = { id, table, waiter: waiterUser, items:[], status:'open', createdAt: nowIso(), closedAt:null, paidAt:null };
      db.orders.push(order); db.nextOrderId=id+1; saveDB(db); return json(order,{status:201});
    }

    // GET /api/orders?table=X&status=...
    if(path==='api/orders' && req.method==='GET'){
      const u = authUser(); if(!u) return json({ error:'Não autenticado' },{status:401});
      const table = (new URL(req.url, location.origin)).searchParams.get('table');
      const status = (new URL(req.url, location.origin)).searchParams.get('status');
      let res = db.orders.slice();
      if(table) res = res.filter(o=>String(o.table)===String(table));
      if(status) res = res.filter(o=>o.status===status);
      return json(res);
    }

    // POST /api/orders/:id/items { productId, qty }
    if(path.startsWith('api/orders/') && path.endsWith('/items') && req.method==='POST'){
      const u = authUser(); if(!u) return json({ error:'Não autenticado' },{status:401});
      const parts = path.split('/'); const id = Number(parts[1]); const order = db.orders.find(o=>o.id===id); if(!order) return json({ error:'Pedido não encontrado' },{status:404});
      if(order.status!=='open') return json({ error:'Pedido não está aberto' },{status:400});
      const b = await req.json(); const { productId, qty } = b||{}; if(!productId || qty===undefined) return json({ error:'productId e qty são obrigatórios' },{status:400});
      const prod = db.products.find(p=>p.id===Number(productId)); if(!prod) return json({ error:'Produto não encontrado' },{status:404});
      const existing = order.items.find(it=>it.productId===prod.id);
      const nqty = Number(qty);
      if(existing){ existing.qty += nqty; if(existing.qty<=0) order.items = order.items.filter(it=>it.productId!==prod.id); }
      else{ if(nqty>0) order.items.push({ productId: prod.id, qty: nqty, priceAtSale: Number(prod.price) }); else return json({ error:'Quantidade inválida' },{status:400}); }
      saveDB(db); return json(order);
    }

    // POST /api/orders/:id/close
    if(path.startsWith('api/orders/') && path.endsWith('/close') && req.method==='POST'){
      const u = authUser(); if(!u) return json({ error:'Não autenticado' },{status:401});
      const parts = path.split('/'); const id = Number(parts[1]); const order = db.orders.find(o=>o.id===id); if(!order) return json({ error:'Pedido não encontrado' },{status:404});
      if(order.status!=='open') return json({ error:'Pedido não está aberto' },{status:400}); order.status='closed'; order.closedAt = nowIso(); saveDB(db); return json(order);
    }

    // POST /api/orders/:id/pay
    if(path.startsWith('api/orders/') && path.endsWith('/pay') && req.method==='POST'){
      const u = authUser(); if(!u) return json({ error:'Não autenticado' },{status:401});
      const parts = path.split('/'); const id = Number(parts[1]); const order = db.orders.find(o=>o.id===id); if(!order) return json({ error:'Pedido não encontrado' },{status:404});
      if(order.status!=='closed') return json({ error:'Pedido precisa estar fechado para pagamento' },{status:400}); order.status='paid'; order.paidAt = nowIso(); saveDB(db); return json(order);
    }

    // GET /api/reports/weekly
    if(path==='api/reports/weekly' && req.method==='GET'){
      const u = authUser(); if(!u || u.role!=='admin') return json({ error:'Acesso negado' },{status:403});
      const now = new Date(); const seven = new Date(now.getTime() - 7*24*60*60*1000);
      const closed = db.orders.filter(o=>o.closedAt && new Date(o.closedAt) >= seven);
      const map = new Map();
      for(const o of closed){ for(const it of o.items){ const prod = db.products.find(p=>p.id===it.productId); if(!prod) continue; const e = map.get(prod.id) || { productId:prod.id, name:prod.name, qty:0, revenue:0, cost:0 }; e.qty += it.qty; e.revenue += it.qty * (it.priceAtSale||prod.price); e.cost += it.qty * (prod.cost||0); map.set(prod.id, e); } }
      const items = Array.from(map.values()).map(e=>({ productId:e.productId, name:e.name, qty:e.qty, revenue: Number(e.revenue.toFixed(2)), cost: Number(e.cost.toFixed(2)), profit: Number((e.revenue-e.cost).toFixed(2)) }));
      const totals = items.reduce((acc,cur)=>{ acc.qty+=cur.qty; acc.revenue+=cur.revenue; acc.cost+=cur.cost; acc.profit+=cur.profit; return acc }, { qty:0, revenue:0, cost:0, profit:0 });
      totals.revenue = Number(totals.revenue.toFixed(2)); totals.cost = Number(totals.cost.toFixed(2)); totals.profit = Number(totals.profit.toFixed(2));
      return json({ from: seven.toISOString(), to: now.toISOString(), items, totals });
    }

    // POST /api/reset
    if(path==='api/reset' && req.method==='POST'){ localStorage.removeItem(DB_KEY); loadDB(); return json({ ok:true }); }

    return json({ error:'Rota não encontrada' },{status:404});
  }

  window.fetch = async function(input, init={}){
    try{
      const url = (typeof input === 'string') ? input : input.url;
      const isApi = url.startsWith('/api') || url.includes(location.origin + '/api');
      if(isApi){ const req = new Request(url, init); return await handle(req); }
      return ORIGINAL_FETCH(input, init);
    }catch(e){ return new Response(JSON.stringify({ error: e.message }), { status:500, headers:{ 'Content-Type':'application/json' } }); }
  };
})();

/* Frontend UI */
(function(){
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  const hide = el => el && el.classList.add('hidden');
  const show = el => el && el.classList.remove('hidden');

  const loginForm = q('#login-form');
  const usernameInput = q('#username');
  const passwordInput = q('#password');
  const authMsg = q('#auth-msg');
  const btnReset = q('#btn-reset');

  const adminPanel = q('#admin-panel');
  const waitersList = q('#waiters-list');
  const productsList = q('#products-list');
  const addWaiterForm = q('#add-waiter-form');
  const waiterUsername = q('#waiter-username');
  const waiterPassword = q('#waiter-password');
  const waiterMsg = q('#waiter-msg');
  const addProductForm = q('#add-product-form');
  const productName = q('#product-name');
  const productCost = q('#product-cost');
  const productPrice = q('#product-price');
  const productMsg = q('#product-msg');
  const btnLogoutAdmin = q('#btn-logout-admin');

  const btnGenerateReport = q('#btn-generate-report');
  const btnExportReport = q('#btn-export-report');
  const reportMsg = q('#report-msg');
  const weeklyReport = q('#weekly-report');
  const reportList = q('#report-list');
  const reportSummary = q('#report-summary');

  const waiterPanel = q('#waiter-panel');
  const tablesContainer = q('#tables');
  const currentTableTitle = q('#current-table-title');
  const orderControls = q('#order-controls');
  const noTableMsg = q('#no-table-msg');
  const productSelect = q('#product-select');
  const productQty = q('#product-qty');
  const btnAddItem = q('#btn-add-item');
  const orderItems = q('#order-items');
  const orderTotals = q('#order-totals');
  const btnCloseBill = q('#btn-close-bill');
  const btnMarkPaid = q('#btn-mark-paid');
  const btnLogoutWaiter = q('#btn-logout-waiter');

  const AUTH_TOKEN_KEY = 'bar-mix-token';

  async function api(path, opts={}){
    const headers = Object.assign({}, opts.headers||{});
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if(token) headers['Authorization'] = 'Bearer ' + token;
    const resp = await fetch(path, Object.assign({}, opts, { headers }));
    const body = await resp.json().catch(()=>null);
    if(!resp.ok) throw Object.assign(new Error(body && body.error ? body.error : 'Erro na API'), { status: resp.status, body });
    return body;
  }

  let currentOrder = null;
  let currentTable = null;

  async function doLogin(e){ e.preventDefault(); authMsg.textContent=''; try{ const data = await api('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: usernameInput.value.trim(), password: passwordInput.value }) }); localStorage.setItem(AUTH_TOKEN_KEY, data.token); usernameInput.value=''; passwordInput.value=''; renderForUser(data.user); }catch(err){ authMsg.textContent = err.message || 'Erro'; authMsg.style.color='#c62828' } }

  async function fetchMeAndRender(){ try{ const me = await api('/api/me', { method:'GET' }); renderForUser(me); }catch(e){ show(q('#auth')); hide(adminPanel); hide(waiterPanel); } }

  function renderForUser(user){ if(!user) return fetchMeAndRender(); hide(q('#auth')); if(user.role==='admin'){ show(adminPanel); hide(waiterPanel); loadWaiters(); loadProducts(); } else { hide(adminPanel); show(waiterPanel); loadProductsForWaiter(); renderTables(); } }

  async function loadWaiters(){ waitersList.innerHTML='Carregando...'; try{ const ws = await api('/api/waiters',{method:'GET'}); waitersList.innerHTML=''; if(ws.length===0) waitersList.innerHTML = '<li class="small-muted">Nenhum garçom cadastrado</li>'; for(const w of ws){ const li = document.createElement('li'); li.textContent = w.username; waitersList.appendChild(li); } }catch(e){ waitersList.innerHTML = '<li class="small-muted">Erro carregando</li>'; } }

  async function loadProducts(){ productsList.innerHTML='Carregando...'; try{ const ps = await api('/api/products',{ method:'GET' }); productsList.innerHTML=''; if(ps.length===0) productsList.innerHTML = '<li class="small-muted">Nenhum produto</li>'; for(const p of ps){ const li = document.createElement('li'); li.innerHTML = `<div><strong>${p.name}</strong><div class="small-muted">Custo: R$ ${Number(p.cost).toFixed(2)} — Venda: R$ ${Number(p.price).toFixed(2)}</div></div>`; productsList.appendChild(li); } populateProductSelect(ps); }catch(e){ productsList.innerHTML = '<li class="small-muted">Erro</li>'; } }

  async function loadProductsForWaiter(){ try{ const ps = await api('/api/products',{ method:'GET' }); populateProductSelect(ps); }catch(e){ if(productSelect) productSelect.innerHTML = '<option>Erro</option>'; } }

  function populateProductSelect(ps){ if(!productSelect) return; productSelect.innerHTML=''; const opt0 = document.createElement('option'); opt0.value=''; opt0.textContent='-- selecione --'; productSelect.appendChild(opt0); for(const p of ps){ const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.name} — R$ ${Number(p.price).toFixed(2)}`; productSelect.appendChild(o); } }

  function makeTableButton(n){ const b = document.createElement('button'); b.className='table-btn'; b.textContent = 'Mesa ' + n; b.dataset.table = n; b.addEventListener('click', ()=> openTable(n)); return b }

  function renderTables(){ if(!tablesContainer) return; tablesContainer.innerHTML = ''; // default 10 mesas
    for(let i=1;i<=10;i++){ tablesContainer.appendChild(makeTableButton(i)); } }

  async function openTable(table){ currentTable = table; currentOrder = null; if(currentTableTitle) currentTableTitle.textContent = 'Mesa: ' + table; if(noTableMsg) noTableMsg.style.display='none'; if(orderControls) orderControls.classList.remove('hidden'); // find open order
    try{ const orders = await api(`/api/orders?table=${table}`, { method:'GET' }); let order = orders.find(o=>o.status==='open'); if(!order){ order = await api('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ table }) }); }
      currentOrder = order; renderOrder(order); }catch(e){ alert(e.message||'Erro'); }
  }

  function renderOrder(order){ if(!order){ if(orderItems) orderItems.innerHTML=''; if(orderTotals) orderTotals.textContent=''; if(btnMarkPaid) btnMarkPaid.classList.add('hidden'); return; } if(orderItems) orderItems.innerHTML=''; let total=0; for(const it of order.items){ const prodOption = productSelect ? Array.from(productSelect.options).find(o=>String(o.value)===String(it.productId)) : null; const name = prodOption ? prodOption.textContent.split(' — ')[0] : ('Produto #' + it.productId); const li = document.createElement('li'); li.textContent = `${it.qty} x ${name} — R$ ${Number(it.priceAtSale || 0).toFixed(2)}`; orderItems.appendChild(li); total += it.qty * (it.priceAtSale || 0); }
    if(orderTotals) orderTotals.textContent = `Total: R$ ${total.toFixed(2)}`; if(order.status==='closed') { if(btnMarkPaid) btnMarkPaid.classList.remove('hidden'); if(btnCloseBill) btnCloseBill.disabled = true; } else { if(btnCloseBill) btnCloseBill.disabled = false; if(btnMarkPaid) btnMarkPaid.classList.add('hidden'); } if(order.status==='paid'){ if(btnMarkPaid) btnMarkPaid.classList.add('hidden'); if(btnCloseBill) btnCloseBill.disabled = true; }
  }

  async function addItemToOrder(){ if(!currentOrder) return alert('Selecione uma mesa'); const prodId = productSelect ? productSelect.value : null; const qty = Number(productQty ? productQty.value : 1) || 1; if(!prodId) return alert('Selecione um produto'); try{ const ord = await api(`/api/orders/${currentOrder.id}/items`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ productId: Number(prodId), qty }) }); currentOrder = ord; renderOrder(ord); }catch(e){ alert(e.message||'Erro adicionando item'); } }

  async function closeBill(){ if(!currentOrder) return; try{ const ord = await api(`/api/orders/${currentOrder.id}/close`, { method:'POST' }); currentOrder = ord; renderOrder(ord); alert('Conta fechada'); }catch(e){ alert(e.message||'Erro ao fechar'); } }

  async function markPaid(){ if(!currentOrder) return; try{ const ord = await api(`/api/orders/${currentOrder.id}/pay`, { method:'POST' }); currentOrder = ord; renderOrder(ord); alert('Pedido marcado como pago'); }catch(e){ alert(e.message||'Erro ao marcar pago'); } }

  async function generateReport(){ if(reportMsg) reportMsg.textContent=''; if(weeklyReport) weeklyReport.classList.add('hidden'); if(reportList) reportList.innerHTML=''; if(reportSummary) reportSummary.textContent=''; try{ const res = await api('/api/reports/weekly',{ method:'GET' }); if(!res.items || res.items.length===0){ if(reportMsg) reportMsg.textContent = 'Nenhuma venda nos últimos 7 dias.'; return; } if(weeklyReport) weeklyReport.classList.remove('hidden'); if(reportSummary) reportSummary.textContent = `Período: ${new Date(res.from).toLocaleString()} → ${new Date(res.to).toLocaleString()} — Receita: R$ ${res.totals.revenue.toFixed(2)} — Custo: R$ ${res.totals.cost.toFixed(2)} — Lucro: R$ ${res.totals.profit.toFixed(2)}`; for(const it of res.items){ const li = document.createElement('li'); li.innerHTML = `<div><strong>${it.name}</strong><div class="small-muted">Qtd: ${it.qty} • Receita: R$ ${it.revenue.toFixed(2)} • Custo: R$ ${it.cost.toFixed(2)} • Lucro: R$ ${it.profit.toFixed(2)}</div></div>`; reportList.appendChild(li); } }catch(e){ if(reportMsg) { reportMsg.textContent = e.message || 'Erro gerando relatório'; reportMsg.style.color = '#c62828' } } }

  function exportReportJson(){ generateReport().then(async ()=>{ try{ const res = await api('/api/reports/weekly',{ method:'GET' }); const blob = new Blob([JSON.stringify(res,null,2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'report-weekly.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }catch(e){ alert('Erro exportando') } }); }

  async function addWaiter(e){ e.preventDefault(); if(waiterMsg) waiterMsg.textContent=''; try{ const res = await api('/api/waiters',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: waiterUsername.value.trim(), password: waiterPassword.value }) }); if(waiterMsg){ waiterMsg.textContent = `Garçom "${res.username}" cadastrado`; waiterMsg.style.color = '#2e7d32'; } waiterUsername.value=''; waiterPassword.value=''; loadWaiters(); }catch(err){ if(waiterMsg){ waiterMsg.textContent = err.message || 'Erro'; waiterMsg.style.color = '#c62828' } } }

  async function addProduct(e){ e.preventDefault(); if(productMsg) productMsg.textContent=''; try{ const res = await api('/api/products',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: productName.value.trim(), cost: Number(productCost.value), price: Number(productPrice.value) }) }); if(productMsg){ productMsg.textContent = `Produto "${res.name}" cadastrado`; productMsg.style.color = '#2e7d32'; } productName.value=''; productCost.value=''; productPrice.value=''; loadProducts(); }catch(err){ if(productMsg){ productMsg.textContent = err.message || 'Erro'; productMsg.style.color = '#c62828' } } }

  function logout(){ localStorage.removeItem(AUTH_TOKEN_KEY); hide(adminPanel); hide(waiterPanel); show(q('#auth')); }

  async function resetDb(){ if(!confirm('Resetar banco de dados para o estado inicial?')) return; try{ await api('/api/reset',{ method:'POST' }); alert('Banco resetado'); location.reload(); }catch(e){ alert('Erro resetando') } }

  // wire events
  if(loginForm) loginForm.addEventListener('submit', doLogin);
  if(addWaiterForm) addWaiterForm.addEventListener('submit', addWaiter);
  if(addProductForm) addProductForm.addEventListener('submit', addProduct);
  if(btnGenerateReport) btnGenerateReport.addEventListener('click', generateReport);
  if(btnExportReport) btnExportReport.addEventListener('click', exportReportJson);
  if(btnReset) btnReset.addEventListener('click', resetDb);
  if(btnLogoutAdmin) btnLogoutAdmin.addEventListener('click', logout);
  if(btnLogoutWaiter) btnLogoutWaiter.addEventListener('click', logout);
  if(btnAddItem) btnAddItem.addEventListener('click', addItemToOrder);
  if(btnCloseBill) btnCloseBill.addEventListener('click', closeBill);
  if(btnMarkPaid) btnMarkPaid.addEventListener('click', markPaid);

  // initial
  document.addEventListener('DOMContentLoaded', ()=>{
    fetchMeAndRender();
  });

})();
// app.js — bar-mix (versão estática + API simulada no navegador)
// Funcionalidades:
// - Administrador: cadastrar garçons e produtos (custo + preço)
// - Garçom: atendimento por mesa, adicionar itens, fechar conta, marcar pago
// - Relatório semanal por produto (receita, custo, lucro)
// - Persistência em localStorage

// ---------- Simulated backend (intercept fetch) ----------
(() => {
  const ORIGINAL_FETCH = window.fetch.bind(window);
  const DB_KEY = 'bar-mix-db-v1';

  function loadDB() {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      const seed = {
        users: [
          { username: 'admin', password: 'admin', role: 'admin' }
        ],
        products: [],
        orders: [],
        nextProductId: 1,
        nextOrderId: 1
      };
      localStorage.setItem(DB_KEY, JSON.stringify(seed));
      return seed;
    } else {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error('DB corrupto — resetando');
        localStorage.removeItem(DB_KEY);
        return loadDB();
      }
    }
  }

  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function makeToken(username) { return btoa(`token:${username}`); }
  function parseToken(token) {
    try {
      const decoded = atob(token);
      if (decoded && decoded.startsWith('token:')) return decoded.slice('token:'.length);
    } catch (e) {}
    return null;
  }

  function jsonResponse(body, opts = {}) {
    const status = opts.status || 200;
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }

  async function handleApiRequest(req) {
    const url = new URL(req.url, location.origin);
    const path = url.pathname.replace(/^\/+/, '');
    const db = loadDB();

    function getAuthUser() {
      const header = req.headers.get('Authorization') || '';
      const parts = header.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const name = parseToken(parts[1]);
        if (name) return db.users.find(u => u.username === name) || null;
      }
      return null;
    }

    // POST /api/login
    if (path === 'api/login' && req.method === 'POST') {
      const body = await req.json();
      const { username, password } = body || {};
      if (!username || !password) {
        return jsonResponse({ error: 'username e password são obrigatórios' }, { status: 400 });
      }
      const user = db.users.find(u => u.username === username && u.password === password);
      if (!user) return jsonResponse({ error: 'Credenciais inválidas' }, { status: 401 });
      const token = makeToken(user.username);
      return jsonResponse({ token, user: { username: user.username, role: user.role } });
    }

    // GET /api/me
    if (path === 'api/me' && req.method === 'GET') {
      const user = getAuthUser();
      if (!user) return jsonResponse({ error: 'Não autenticado' }, { status: 401 });
      return jsonResponse({ username: user.username, role: user.role });
    }

    // GET /api/waiters
    if (path === 'api/waiters' && req.method === 'GET') {
      const user = getAuthUser();
      if (!user || user.role !== 'admin') return jsonResponse({ error: 'Acesso negado' }, { status: 403 });
      const waiters = db.users.filter(u => u.role === 'waiter').map(u => ({ username: u.username }));
      return jsonResponse(waiters);
    }

    // POST /api/waiters
    if (path === 'api/waiters' && req.method === 'POST') {
      const user = getAuthUser();
      if (!user || user.role !== 'admin') return jsonResponse({ error: 'Acesso negado' }, { status: 403 });
      const body = await req.json();
      const { username, password } = body || {};
      if (!username || !password) return jsonResponse({ error: 'username e password são obrigatórios' }, { status: 400 });
      if (db.users.some(u => u.username === username)) {
        return jsonResponse({ error: 'Usuário já existe' }, { status: 409 });
      }
      const newUser = { username, password, role: 'waiter' };
      db.users.push(newUser);
      saveDB(db);
      return jsonResponse({ username: newUser.username, role: newUser.role }, { status: 201 });
    }

    // GET /api/products
    if (path === 'api/products' && req.method === 'GET') {
      return jsonResponse(db.products || []);
    }

    // POST /api/products
    if (path === 'api/products' && req.method === 'POST') {
      const user = getAuthUser();
      if (!user || user.role !== 'admin') return jsonResponse({ error: 'Acesso negado' }, { status: 403 });
      const body = await req.json();
      const { name, cost, price } = body || {};
      if (!name || cost === undefined || price === undefined) return jsonResponse({ error: 'name, cost e price são obrigatórios' }, { status: 400 });
      if (db.products.some(p => p.name === name)) return jsonResponse({ error: 'Produto já existe' }, { status: 409 });
      const id = db.nextProductId || 1;
      const p = { id, name, cost: Number(cost), price: Number(price) };
      db.products.push(p);
      db.nextProductId = id + 1;
      saveDB(db);
      return jsonResponse(p, { status: 201 });
    }

    // POST /api/orders  { table, waiter }
    if (path === 'api/orders' && req.method === 'POST') {
      const user = getAuthUser();
      if (!user) return jsonResponse({ error: 'Não autenticado' }, { status: 401 });
      const body = await req.json();
      const { table, waiter } = body || {};
      if (!table) return jsonResponse({ error: 'table é obrigatório' }, { status: 400 });
      const waiterUser = waiter || user.username;
      const found = db.users.find(u => u.username === waiterUser && u.role === 'waiter');
      if (!found && user.role !== 'admin') return jsonResponse({ error: 'Garçom inválido' }, { status: 400 });
      const id = db.nextOrderId || 1;
      const order = {
        id,
        table,
        waiter: waiterUser,
        items: [],
        status: 'open',
        createdAt: new Date().toISOString(),
        closedAt: null,
        paidAt: null
      };
      db.orders.push(order);
      db.nextOrderId = id + 1;
      saveDB(db);
      return jsonResponse(order, { status: 201 });
    }

    // GET /api/orders  optionally ?table=X or ?status=open|closed|paid
    if (path === 'api/orders' && req.method === 'GET') {
      const user = getAuthUser();
      if (!user) return jsonResponse({ error: 'Não autenticado' }, { status: 401 });
      const table = url.searchParams.get('table');
      const status = url.searchParams.get('status');
      let res = db.orders.slice();
      if (table) res = res.filter(o => String(o.table) === String(table));
      if (status) res = res.filter(o => o.status === status);
      return jsonResponse(res);
    }

    // POST /api/orders/:id/items  { productId, qty }
    if (path.startsWith('api/orders/') && path.endsWith('/items') && req.method === 'POST') {
      const user = getAuthUser();
      if (!user) return jsonResponse({ error: 'Não autenticado' }, { status: 401 });
      const parts = path.split('/');
      const id = Number(parts[1]);
      const order = db.orders.find(o => o.id === id);
      if (!order) return jsonResponse({ error: 'Pedido não encontrado' }, { status: 404 });
      if (order.status !== 'open') return jsonResponse({ error: 'Pedido não está aberto' }, { status: 400 });
      const body = await req.json();
      const { productId, qty } = body || {};
      if (!productId || qty === undefined) return jsonResponse({ error: 'productId e qty são obrigatórios' }, { status: 400 });
      const prod = db.products.find(p => p.id === Number(productId));
      if (!prod) return jsonResponse({ error: 'Produto não encontrado' }, { status: 404 });
      // Support negative qty to decrement/remove items (prototype convenience)
      const existing = order.items.find(it => it.productId === prod.id);
      const nqty = Number(qty);
      if (existing) {
        existing.qty += nqty;
        if (existing.qty <= 0) {
          order.items = order.items.filter(it => it.productId !== prod.id);
        }
      } else {
        if (nqty > 0) {
          order.items.push({ productId: prod.id, qty: nqty, priceAtSale: Number(prod.price) });
        } else {
          return jsonResponse({ error: 'Quantidade inválida' }, { status: 400 });
        }
      }
      saveDB(db);
      return jsonResponse(order);
    }

    // POST /api/orders/:id/close
    if (path.startsWith('api/orders/') && path.endsWith('/close') && req.method === 'POST') {
      const user = getAuthUser();
      if (!user) return jsonResponse({ error: 'Não autenticado' }, { status: 401 });
      const parts = path.split('/');
      const id = Number(parts[1]);
      const order = db.orders.find(o => o.id === id);
      if (!order) return jsonResponse({ error: 'Pedido não encontrado' }, { status: 404 });
      if (order.status !== 'open') return jsonResponse({ error: 'Pedido não está aberto' }, { status: 400 });
      order.status = 'closed';
      order.closedAt = new Date().toISOString();
      saveDB(db);
      return jsonResponse(order);
    }

    // POST /api/orders/:id/pay
    if (path.startsWith('api/orders/') && path.endsWith('/pay') && req.method === 'POST') {
      const user = getAuthUser();
      if (!user) return jsonResponse({ error: 'Não autenticado' }, { status: 401 });
      const parts = path.split('/');
      const id = Number(parts[1]);
      const order = db.orders.find(o => o.id === id);
      if (!order) return jsonResponse({ error: 'Pedido não encontrado' }, { status: 404 });
      if (order.status !== 'closed') return jsonResponse({ error: 'Pedido precisa estar fechado para pagamento' }, { status: 400 });
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      saveDB(db);
      return jsonResponse(order);
    }

    // GET /api/reports/weekly
    if (path === 'api/reports/weekly' && req.method === 'GET') {
      const user = getAuthUser();
      if (!user || user.role !== 'admin') return jsonResponse({ error: 'Acesso negado' }, { status: 403 });
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const closedOrders = db.orders.filter(o => o.closedAt && new Date(o.closedAt) >= sevenDaysAgo);
      const map = new Map();
      for (const o of closedOrders) {
        for (const it of o.items) {
          const prod = db.products.find(p => p.id === it.productId);
          if (!prod) continue;
          const key = prod.id;
          const entry = map.get(key) || { productId: prod.id, name: prod.name, qty: 0, revenue: 0, cost: 0 };
          entry.qty += it.qty;
          entry.revenue += it.qty * (it.priceAtSale || prod.price);
          entry.cost += it.qty * (prod.cost || 0);
          map.set(key, entry);
        }
      }
      const list = Array.from(map.values()).map(e => ({
        productId: e.productId,
        name: e.name,
        qty: e.qty,
        revenue: Number(e.revenue.toFixed(2)),
        cost: Number(e.cost.toFixed(2)),
        profit: Number((e.revenue - e.cost).toFixed(2))
      }));
      const totals = list.reduce((acc, cur) => {
        acc.qty += cur.qty;
        acc.revenue += cur.revenue;
        acc.cost += cur.cost;
        acc.profit += cur.profit;
        return acc;
      }, { qty: 0, revenue: 0, cost: 0, profit: 0 });
      totals.revenue = Number(totals.revenue.toFixed(2));
      totals.cost = Number(totals.cost.toFixed(2));
      totals.profit = Number(totals.profit.toFixed(2));
      return jsonResponse({ from: sevenDaysAgo.toISOString(), to: now.toISOString(), items: list, totals });
    }

    // DB reset
    if (path === 'api/reset' && req.method === 'POST') {
      localStorage.removeItem(DB_KEY);
      loadDB();
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'Rota não encontrada' }, { status: 404 });
  }

  window.fetch = async function (input, init = {}) {
    try {
      const url = typeof input === 'string' ? input : input.url;
      const isApi = url.startsWith('/api') || url.includes(location.origin + '/api');
      if (isApi) {
        const req = new Request(url, init);
        return await handleApiRequest(req);
      } else {
        return ORIGINAL_FETCH(input, init);
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  };
})();

// ---------- Frontend UI ----------
(function () {
  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.from(document.querySelectorAll(sel)); }
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  const loginForm = q('#login-form');
  const usernameInput = q('#username');
  const passwordInput = q('#password');
  const authMsg = q('#auth-msg');
  const btnReset = q('#btn-reset');

  const adminPanel = q('#admin-panel');
  const waitersList = q('#waiters-list');
  const productsList = q('#products-list');
  const addWaiterForm = q('#add-waiter-form');
  const waiterUsername = q('#waiter-username');
  const waiterPassword = q('#waiter-password');
  const waiterMsg = q('#waiter-msg');
  const addProductForm = q('#add-product-form');
  const productName = q('#product-name');
  const productCost = q('#product-cost');
  const productPrice = q('#product-price');
  const productMsg = q('#product-msg');
  const btnLogoutAdmin = q('#btn-logout-admin');

  const btnGenerateReport = q('#btn-generate-report');
  const btnExportReport = q('#btn-export-report');
  const reportMsg = q('#report-msg');
  const weeklyReport = q('#weekly-report');
  const reportList = q('#report-list');
  const reportSummary = q('#report-summary');

  const waiterPanel = q('#waiter-panel');
  const tablesContainer = q('#tables');
  const currentTableTitle = q('#current-table-title');
  const orderControls = q('#order-controls');
  const noTableMsg = q('#no-table-msg');
  const productSelect = q('#product-select');
  const productQty = q('#product-qty');
  const btnAddItem = q('#btn-add-item');
  const orderItems = q('#order-items');
  const orderTotals = q('#order-totals');
  const btnCloseBill = q('#btn-close-bill');
  const btnMarkPaid = q('#btn-mark-paid');
  const btnLogoutWaiter = q('#btn-logout-waiter');

  const AUTH_TOKEN_KEY = 'bar-mix-token';

  async function api(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {});
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const resp = await fetch(path, Object.assign({}, opts, { headers }));
    const body = await resp.json().catch(() => null);
    if (!resp.ok) {
      throw Object.assign(new Error(body && body.error ? body.error : 'Erro na API'), { status: resp.status, body });
    }
    return body;
  }

  async function doLogin(evt) {
    evt.preventDefault();
    authMsg.textContent = '';
    try {
      const data = await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.value.trim(),
          password: passwordInput.value
        })
      });
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      usernameInput.value = '';
      passwordInput.value = '';
      renderForUser(data.user);
    } catch (err) {
      authMsg.textContent = err.message || 'Erro';
      authMsg.style.color = '#c62828';
    }
  }

  async function fetchMeAndRender() {
    try {
      const me = await api('/api/me', { method: 'GET' });
      renderForUser(me);
    } catch (e) {
      show(q('#auth'));
      hide(adminPanel);
      hide(waiterPanel);
    }
  }

  function renderForUser(user) {
    if (!user) return fetchMeAndRender();
    hide(q('#auth'));
    if (user.role === 'admin') {
      show(adminPanel);
      hide(waiterPanel);
      loadWaiters();
      loadProducts();
    } else {
      hide(adminPanel);
      show(waiterPanel);
      loadProductsForWaiter();
      renderTables();
    }
  }

  async function loadWaiters() {
    waitersList.innerHTML = 'Carregando...';
    try {
      const ws = await api('/api/waiters', { method: 'GET' });
      waitersList.innerHTML = '';
      if (ws.length === 0) waitersList.innerHTML = '<li class="small-muted">Nenhum garçom cadastrado</li>';
      for (const w of ws) {
        const li = document.createElement('li');
        li.textContent = w.username;
        waitersList.appendChild(li);
      }
    } catch (e) {
      waitersList.innerHTML = '<li class="small-muted">Erro carregando</li>';
    }
  }

  async function loadProducts() {
    productsList.innerHTML = 'Carregando...';
    try {
      const ps = await api('/api/products', { method: 'GET' });
      productsList.innerHTML = '';
      if (ps.length === 0) productsList.innerHTML = '<li class="small-muted">Nenhum produto</li>';
      for (const p of ps) {
        const li = document.createElement('li');
        li.innerHTML = `<div><strong>${p.name}</strong><div class="small-muted">Custo: R$ ${Number(p.cost).toFixed(2)} — Venda: R$ ${Number(p.price).toFixed(2)}</div></div>`;
        productsList.appendChild(li);
      }
      populateProductSelect(ps);
    } catch (e) {
      productsList.innerHTML = '<li class="small-muted">Erro</li>';
    }
  }

  async function addWaiter(evt) {
    evt.preventDefault();
    waiterMsg.textContent = '';
    try {
      const res = await api('/api/waiters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: waiterUsername.value.trim(),
          password: waiterPassword.value
        })
      });
      waiterMsg.textContent = `Garçom "${res.username}" cadastrado`;
      waiterMsg.style.color = '#2e7d32';
      waiterUsername.value = '';
      waiterPassword.value = '';
      loadWaiters();
    } catch (e) {
      waiterMsg.textContent = e.message || 'Erro';
      waiterMsg.style.color = '#c62828';
    }
  }

  async function addProduct(evt) {
    evt.preventDefault();
    productMsg.textContent = '';
    try {
      const res = await api('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productName.value.trim(),
          cost: Number(productCost.value),
          price: Number(productPrice.value)
        })
      });
      productMsg.textContent = `Produto "${res.name}" cadastrado`;
      productMsg.style.color = '#2e7d32';
      productName.value = '';
      productCost.value = '';
      productPrice.value = '';
      loadProducts();
    } catch (e) {
      productMsg.textContent = e.message || 'Erro';
      productMsg.style.color = '#c62828';
    }
  }

  async function generateReport() {
    reportMsg.textContent = '';
    weeklyReport.classList.add('hidden');
    reportList.innerHTML = '';
    reportSummary.textContent = '';
    try {
      const res = await api('/api/reports/weekly', { method: 'GET' });
      if (res.items.length === 0) {
        reportMsg.textContent = 'Nenhuma venda nos últimos 7 dias.';
        return;
      }
      weeklyReport.classList.remove('hidden');
      reportSummary.textContent = `Período: ${new Date(res.from).toLocaleString()} → ${new Date(res.to).toLocaleString()} — Receita: R$ ${res.totals.revenue.toFixed(2)} — Custo: R$ ${res.totals.cost.toFixed(2)} — Lucro: R$ ${res.totals.profit.toFixed(2)}`;
      reportList.innerHTML = '';
      for (const item of res.items) {
        const li = document.createElement('li');
        li.innerHTML = `<div><strong>${item.name}</strong><div class="small-muted">Qtd: ${item.qty} • Receita: R$ ${item.revenue.toFixed(2)} • Custo: R$ ${item.cost.toFixed