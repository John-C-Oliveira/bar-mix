import { initUI } from './js/ui.js'

window.addEventListener('DOMContentLoaded', ()=>{
  initUI().catch(err=>{ console.error(err); alert('Erro inicializando UI: '+err.message) })
})
