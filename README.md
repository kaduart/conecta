# RECUPERA · MVP (API Node + Web React mobile-first)

Auditoria de INSS pago acima do teto por quem tem mais de um vínculo, com prescrição de 5 anos, painel do contador, contrato de êxito e aviso por WhatsApp.

## Estrutura
- `server/`: Node 20 + Express + MongoDB/Mongoose + Redis/BullMQ
  - `src/engine/`: motor de cálculo (`params.js` com teto, faixas e cota máxima por vigência; `teto.js` com `auditar()`)
  - `src/parsers/`: PDF → texto → JSON (CNIS e informe de rendimentos)
  - `src/models/`: Contador, Lead, Relatorio
  - `src/routes/`: `publico.js` (fluxo do cliente) e `contador.js` (painel, JWT)
  - `src/queues/`: filas `processar-auditoria`, `notificar-contador`, `limpeza-lgpd` (5 tentativas, backoff exponencial, jobId idempotente)
  - `src/services/`: criptografia AES-256-GCM, storage, WhatsApp (Evolution/Z-API), webhook com HMAC, contrato, CSV do PER/DCOMP
  - `templates/contrato.md`: minuta de honorários de êxito (até 30%)
- `web/`: Vite + React 18 + Tailwind, mobile-first, PWA (instala na tela inicial do iPhone)

## Rodar local
```
cd server && cp .env.example .env    # preencher JWT_SECRET e ENC_KEY
npm install && npm test              # 13 testes
npm run dev                          # API em :4000
npm run worker                       # outro terminal
node scripts/seed-contador.js "Silva & Associados" "Carlos Silva" "CRC-DF 012345/O-1" carlos@silva.com 5561999990000 silva
cd ../web && cp .env.example .env && npm install && npm run dev   # :5173
```
Cliente: `http://localhost:5173/c/silva` · Contador: `http://localhost:5173/painel/login`

## Rotas da API (`/v1`)
| Método | Rota | Auth | O que faz |
|---|---|---|---|
| GET | `/i/:slug` | — | dados do escritório que convida |
| POST | `/i/:slug/leads` | — | nome, profissão, WhatsApp → `leadId` + `leadToken` (idempotente por WhatsApp) |
| POST | `/leads/:id/consent` | X-Lead-Token | grava aceite, data/hora, IP, user agent, versão do termo |
| POST | `/leads/:id/documents` | X-Lead-Token | multipart `arquivos[]` + `tipos[]` (PDF ≤ 10 MB, dedupe por sha256) |
| POST | `/leads/:id/process` | X-Lead-Token | enfileira a auditoria (chave = hash dos docs + versão do motor) |
| GET | `/leads/:id/status` | X-Lead-Token | status + `indicio` (sem valores) |
| POST | `/leads/:id/copia-relatorio` | X-Lead-Token | pedido do titular (LGPD), prazo de 15 dias |
| POST | `/contador/login` | — | e-mail + chave → JWT 12h |
| GET | `/contador/analises` | Bearer | lista ordenada por recuperável, com prioridade |
| GET | `/contador/analises/:id` | Bearer | relatório completo, alerta comercial e roteiro |
| GET | `/contador/analises/:id/contrato` | Bearer | contrato preenchido (Markdown) |
| GET | `/contador/analises/:id/perdcomp.csv` | Bearer | planilha de apoio ao PER/DCOMP |
| PATCH | `/contador/analises/:id/status` | Bearer | CONTRATO_ENVIADO / PROTOCOLADO |

Webhook opcional ao CRM do escritório: evento `auditoria.concluida`, header `X-Recupera-Signature: sha256=<hmac>` e `Idempotency-Key`.

## Correções em relação ao briefing
1. **Prescrição não tem corte fixo em nov/2021.** São 5 anos contados do pagamento (dia 20 do mês seguinte). Em 02/11/2026, out/2021 ainda vale até 20/11/2026 e set/2021 já prescreveu. O motor calcula isso mês a mês.
2. **751,99 · 828,38 · 877,24 · 908,85 · 951,62 são cotas máximas de contribuição, não tetos.** Os tetos (salário de contribuição) são, por exemplo, R$ 7.786,02 em 2024 e R$ 8.157,41 em 2025. O motor guarda os dois.
3. **2026 não está confirmado** (teto e faixas nulos, cota 991,43 marcada `confirmado:false`). Isso gera o alerta `PARAMETRO_PENDENTE` até alguém conferir a Portaria.
4. **A bitributação desde jul/2022 não está fixa no código.** O motor detecta o primeiro mês com 2 ou mais vínculos e excesso (`gatilhos.bitributacaoDesde`).
5. **Chave PIX de comissão:** pagar comissão a contador por indicação pode ser visto como agenciamento ou captação vedada pelo Código de Ética do CRC. O campo existe e é cifrado, mas o modelo de remuneração precisa ser validado antes do uso.
6. **Contrato:** é uma minuta técnica e precisa de revisão de advogado antes do primeiro uso.
7. **Parser de PDF:** as regex são heurísticas. Calibrar com CNIS e informes reais. Quando a leitura falha, o lead vai para "Revisão manual".

## O que ainda falta para produção
- Testar ponta a ponta com MongoDB real (aqui foram testados o motor, os parsers e as regras de negócio).
- Trocar o storage local por S3/GCS com SSE-KMS.
- Converter o contrato em PDF e integrar assinatura eletrônica.
- Confirmar as rotas da Evolution API/Z-API na versão contratada.

## Branches e deploy
- `develop`: desenvolvimento. Todo push roda o CI (testes da API + build do front).
- `main`: produção. Entra só por PR vindo da `develop`. Ao mergear, `.github/workflows/deploy.yml` roda os testes de novo e publica o front na Vercel.
- O deploy automático da integração Git da Vercel está desligado (`web/vercel.json`) para não duplicar com o Actions.

### Configurar uma vez
1. Vercel: importar o repositório, com **Root Directory = `web`** e framework Vite. Em Environment Variables, criar `VITE_API_URL` com a URL da API.
2. Rodar `npx vercel link` dentro de `web/` e copiar `orgId` e `projectId` de `.vercel/project.json`.
3. GitHub > Settings > Secrets and variables > Actions: criar os secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`, e a variable `VITE_API_URL`.
4. GitHub > Settings > Branches: proteger a `main` (exigir PR e o CI verde).

### API e worker
A Vercel publica só o front. A API Express e o worker BullMQ precisam de processo contínuo, Mongo e Redis, então vão para Render, Railway ou Fly.io (por exemplo, Mongo Atlas + Upstash Redis).
