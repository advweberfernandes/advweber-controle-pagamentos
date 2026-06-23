# Controle de Pagamentos - TODO

## Banco de Dados
- [x] Tabela `clients` (id, name, totalFees, installmentCount, installmentValue, startDate, createdAt)
- [x] Tabela `installments` (id, clientId, number, dueDate, paidAt, status)
- [x] Gerar migration SQL e aplicar via webdev_execute_sql

## Backend (tRPC)
- [x] Procedure: clients.list (listar todos os clientes)
- [x] Procedure: clients.create (cadastrar cliente + gerar parcelas automaticamente)
- [x] Procedure: clients.getById (buscar cliente com parcelas)
- [x] Procedure: clients.delete (remover cliente e parcelas)
- [x] Procedure: installments.markPaid (marcar parcela como paga, registrar data automática)
- [x] Procedure: installments.carnê (listar todas as parcelas de todos os clientes para carnê consolidado)

## Frontend
- [x] Configurar DashboardLayout com sidebar elegante
- [x] Paleta de cores sofisticada (tons escuros/dourados) no index.css
- [x] Fontes Google (Inter + Playfair Display)
- [x] Página: Lista de Clientes (cards com resumo de status)
- [x] Página: Detalhe do Cliente (parcelas individuais com status visual)
- [x] Página: Carnê Consolidado (tabela completa de todos os clientes)
- [x] Modal: Cadastro de novo cliente
- [x] Indicador visual de atraso (badge vermelho) que some ao marcar pago
- [x] Botão "Marcar como Pago" com confirmação
- [x] Estados de loading e empty state elegantes

## Testes
- [x] Teste: criar cliente e verificar geração de parcelas
- [x] Teste: marcar parcela como paga e verificar data automática

## Entrega
- [x] Checkpoint final

## Exportação PDF
- [x] Instalar biblioteca jsPDF + jspdf-autotable no frontend
- [x] Criar utilitário generateClientPDF com dados do cliente e parcelas
- [x] Adicionar botão "Exportar PDF" em cada card de cliente no Carnê Consolidado
- [x] PDF deve conter: nome do cliente, valor total, tabela de parcelas (número, vencimento, pagamento, status)
- [x] Testar geração e download do PDF
