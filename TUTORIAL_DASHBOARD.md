# Dashboard de análises — uso e configuração

## O que muda para o usuário

O menu lateral ganha o item **Dashboard**, ao lado de Histórico. A tela resume as análises do Teste Folha no período escolhido (7, 30, 90 dias ou todo o período) e pode ser filtrada por talhão. Admin também filtra por usuário.

| Bloco | O que mostra |
| --- | --- |
| Resumo | Tentativas, concluídas, sem resultado (falhas e interrompidas) e em andamento; taxa de conclusão; tempo médio de processamento. |
| O que o modelo classificou | Quantidade e percentual por classificação, somente de análises concluídas. |
| Análises por dia, semana ou mês | Barras com concluídas e sem resultado ou em andamento. O agrupamento muda com o período. |
| Por talhão | Tentativas, concluídas, sem resultado e classificação mais frequente. |
| Por usuário | Somente Admin. Tentativas, concluídas e sem resultado por pessoa. |
| Motivos de falha e interrupção | Quantidade por motivo, com os códigos gravados em `erro.codigo`. |

Admin vê todas as análises. Funcionário vê somente as próprias, a mesma regra do Histórico. A rota fica atrás de `acessoTalhoes` em `src/app/_layout.js`.

## Regras de leitura dos números

- Gráficos de classificação usam apenas `status == CONCLUIDA`. Falhas, interrupções e pendências aparecem como indicadores operacionais separados.
- A taxa de conclusão considera só tentativas encerradas (concluídas, falhas e interrompidas). Quem está em andamento não entra na conta.
- O tempo médio usa `duracaoProcessamentoMs` das análises concluídas e não inclui o envio da foto pelo celular.
- Cada tentativa conta uma vez, inclusive uma nova análise da mesma foto.
- A pontuação do modelo não é usada para estimar gravidade nem área afetada, e as classificações não confirmam um diagnóstico.
- "Últimos N dias" inclui hoje: 7 dias são hoje e os 6 dias anteriores, a partir de 00:00 do horário do aparelho.
- Códigos de falha desconhecidos aparecem como "Outro motivo (CÓDIGO)", sem esconder registros. Para dar nome a um código novo, edite `MOTIVOS_FALHA` em `src/utils/dashboardAnalises.js`.

## Limite de leitura

A tela lê no máximo **500 análises** por consulta (`LIMITE_DASHBOARD` em `src/services/historicoAnalises.js`) e calcula os indicadores no aparelho. Se o filtro tiver mais registros, o app mostra um aviso e usa as 500 mais recentes; escolher um período menor ou um talhão resolve.

Cada abertura ou atualização lê até 501 documentos. O limite protege o custo do Firestore e o volume baixado em conexões instáveis. Quando o uso crescer a ponto de o aviso aparecer com frequência, a evolução prevista é calcular resumos diários no servidor (função agendada) e consultá-los em vez dos documentos.

## Nada novo para publicar no Firebase

A consulta usa apenas filtros que já têm índice em `firestore.indexes.json` (`usuarioId` e/ou `talhaoId` com `criadoEm`) e as regras atuais de leitura de `analises`. Não há função, regra ou índice novo. Basta recarregar o aplicativo pelo Expo.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `src/screens/Dashboard.js` | Tela, filtros e desenho dos gráficos com `View`, sem biblioteca nova. |
| `src/utils/dashboardAnalises.js` | Cálculos puros (resumo, classificações, séries, talhões, usuários, falhas). |
| `src/services/historicoAnalises.js` | `listarAnalisesPainel`, consulta limitada para o dashboard. |
| `src/app/dashboard.js` | Rota `/dashboard`. |
| `src/app/_layout.js`, `src/screens/Home.js` | Registro da rota e item no menu. |
| `tests/dashboardAnalises.test.mjs` | 14 testes dos cálculos. |

## Testar

```bash
npm run test:dashboard
```

Os testes cobrem contagens por situação, exclusão de falhas no gráfico de classificação, agrupamento por talhão e usuário, motivos de falha, séries por dia, semana e mês (com dias sem análise e limite de 24 meses) e lista vazia.

Conferência manual no aparelho:

1. Com uma conta Admin, faça análises que concluam e análises que falhem (por exemplo, uma foto sem folha).
2. Abra Dashboard e compare os totais com a lista do Histórico no mesmo período.
3. Troque o período e o talhão e confira se os números mudam junto com os filtros.
4. Entre com uma conta Funcionário: o filtro e a seção de usuário não devem aparecer, e os números devem refletir só as próprias análises.
5. Desligue a internet e toque em atualizar: deve aparecer o aviso de erro com "Tentar novamente", nunca uma tela de zeros.
