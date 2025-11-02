import { api } from './api.js'

function el(id){ return document.getElementById(id) }

export async function initUI(){
  const loginForm = el('loginForm')
  loginForm.addEventListener('submit', async (ev)=>{
    ev.preventDefault()
    const username = el('username').value
    const password = el('password').value
    try{
      await api.login({username,password})
      document.getElementById('login').classList.add('hidden')
      document.getElementById('appShell').classList.remove('hidden')
      await renderTables()
      await renderProducts()
    }catch(err){ alert(err.message) }
  })
}

async function renderTables(){
  const ul = el('tablesList'); ul.innerHTML=''
  const tables = await api.getTables()
  tables.forEach(t=>{
    const li = document.createElement('li');
    li.textContent = 'Mesa ' + t
    li.addEventListener('click', ()=>openOrderForTable(t))
    ul.appendChild(li)
  })
}

async function renderProducts(){
  const ul = el('productsList'); ul.innerHTML=''
  const products = await api.getProducts()
  products.forEach(p=>{
    const li = document.createElement('li');
    li.textContent = `${p.name} — R$ ${p.price.toFixed(2)}`
    li.addEventListener('click', ()=>addProductToCurrentOrder(p.id))
    ul.appendChild(li)
  })
}

let currentOrder = null

async function openOrderForTable(table){
  // create or open order
  const orders = await api.getOrders()
  let order = orders.find(o=>o.table===table && o.status==='open')
  if(!order){ order = await api.createOrder({table, waiter:'demo'}) }
  currentOrder = order
  renderOrder(order)
}

function renderOrder(order){
  const panel = el('orderPanel'); panel.innerHTML = ''
  const h = document.createElement('h4'); h.textContent = `Mesa ${order.table} — Pedido ${order.id}`
  panel.appendChild(h)
  const ul = document.createElement('ul')
  order.items.forEach(i=>{ const li = document.createElement('li'); li.textContent = `${i.qty}x ${i.product} — R$ ${i.price}`; ul.appendChild(li) })
  panel.appendChild(ul)
  const btnClose = document.createElement('button'); btnClose.textContent='Fechar'; btnClose.addEventListener('click', async ()=>{ await api.closeOrder({orderId:order.id}); openOrderForTable(order.table) })
  panel.appendChild(btnClose)
}

async function addProductToCurrentOrder(productId){
  if(!currentOrder) return alert('Selecione uma mesa primeiro')
  const order = await api.addItem({orderId:currentOrder.id, productId, qty:1})
  currentOrder = order
  renderOrder(order)
}
