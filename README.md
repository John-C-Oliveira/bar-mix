```markdown
# bar-mix

Aplicação simples de gerenciamento de restaurante (front + API simulada) que roda inteiramente no navegador. Protótipo para demonstrar:
- Usuário administrador e garçom
- Cadastro de produtos com preço de entrada (custo) e preço de venda
- Atendimento por mesa: garçom atende mesa, adiciona itens ao pedido
- Fechamento e pagamento de contas
- Relatório semanal de lucro por produto
- Persistência em localStorage (sem backend real)

Como executar
1. Clone o repositório ou baixe os arquivos.
2. Abra o arquivo `index.html` em um navegador moderno (Chrome/Edge/Firefox).
3. A aplicação roda inteiramente no navegador e salva dados em localStorage.

Credenciais iniciais
- Administrador: usuário `admin`, senha `admin`
- Garçons: cadastrar via painel do admin

Endpoints simulados (API interceptando fetch /api/*)
- POST /api/login
- GET /api/me
- GET /api/waiters
- POST /api/waiters
- GET /api/products
- POST /api/products
- POST /api/orders
- GET /api/orders
- POST /api/orders/:id/items
- POST /api/orders/:id/close
- POST /api/orders/:id/pay
- GET /api/reports/weekly
- POST /api/reset

Observações
- Esta é uma demonstração. Senhas são armazenadas em texto simples e o token é simplificado — NÃO usar em produção.
- Relatório semanal considera pedidos "closed" dos últimos 7 dias.
```