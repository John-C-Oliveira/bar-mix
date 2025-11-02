/* Simulated API for Bar Mix demo
   Exposes async functions to interact with in-memory/localStorage data.
*/

const STORAGE_KEY = 'bar-mix-db-v1'

function _nowIso(){ return new Date().toISOString() }

const fallbackSeed = {
  users:[{id:1,username:'admin',password:'admin',role:'admin'}],
  products:[{id:1,name:'Cerveja',cost:2.0,price:6.0},{id:2,name:'Petisco',cost:3.0,price:12.0}],
  tables:[1,2,3,4,5],
  orders:[]
}

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY)
    if(!raw){ localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackSeed)); return JSON.parse(JSON.stringify(fallbackSeed)) }
    return JSON.parse(raw)
  }catch(e){ return JSON.parse(JSON.stringify(fallbackSeed)) }
}

function save(db){ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)) }

function findUser(username,password){
  const db = load();
  return db.users.find(u=>u.username===username && u.password===password)
}

export const api = {
  async login({username,password}){
    const u = findUser(username,password)
    if(!u) throw new Error('Credenciais inválidas')
    return { token: 'demo-token', user: { id:u.id, username:u.username, role:u.role } }
  },
  async me(){
    // simplified
    return { user: { username:'admin', role:'admin' } }
  },
  async getProducts(){ return load().products },
  async addProduct(p){ const db=load(); p.id = Date.now(); db.products.push(p); save(db); return p },
  async getTables(){ return load().tables },
  async getOrders(){ return load().orders },
  async createOrder({table, waiter}){
    const db = load();
    const order = { id: Date.now(), table, waiter, items:[], status:'open', createdAt:_nowIso() }
    db.orders.push(order); save(db); return order
  },
  async addItem({orderId,productId,qty=1}){
    const db=load();
    const order = db.orders.find(o=>o.id==orderId)
    if(!order) throw new Error('Pedido não encontrado')
    const product = db.products.find(p=>p.id==productId)
    if(!product) throw new Error('Produto não encontrado')
    order.items.push({id:Date.now(),product:product.name,productId,qty,price:product.price})
    save(db); return order
  },
  async closeOrder({orderId}){
    const db=load(); const order = db.orders.find(o=>o.id==orderId); if(!order) throw new Error('Pedido não encontrado')
    order.status='closed'; order.closedAt=_nowIso(); save(db); return order
  },
  async payOrder({orderId,amount}){
    const db=load(); const order = db.orders.find(o=>o.id==orderId); if(!order) throw new Error('Pedido não encontrado')
    order.paid = true; order.paidAt=_nowIso(); order.paymentAmount=amount; save(db); return order
  },
  async reportsWeekly(){
    const db=load();
    const weekAgo = Date.now() - (7*24*60*60*1000)
    const closed = db.orders.filter(o=>o.status==='closed' && new Date(o.closedAt).getTime()>=weekAgo)
    // aggregate by product
    const agg = {}
    closed.forEach(o=>o.items.forEach(i=>{ agg[i.product]=(agg[i.product]||0)+ (i.qty*i.price) }))
    return { byProduct: agg }
  },
  async reset(){ localStorage.removeItem(STORAGE_KEY); localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackSeed)); return true }
}

// For direct fetch interception (optional), you could monkeypatch fetch here in the browser.
