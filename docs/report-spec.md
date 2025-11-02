# Relatório semanal — especificação

Este documento descreve a formulação do relatório semanal de lucro por produto.

Entrada
- Pedidos com status `closed` e `closedAt` nos últimos 7 dias.

Agregação
- Para cada item em cada pedido, somar (qty * price) por produto.

Saída
```
{
  byProduct: {
    "Cerveja": 120.00,
    "Petisco": 80.00
  }
}
```

Observações
- O relatório usa preço de venda; se quiser lucro usar (price - cost) * qty.
