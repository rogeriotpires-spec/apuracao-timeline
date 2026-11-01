# Painel de Controle Timeline

Endereço: **painel.revistatimeline.com**, servido pelo Worker `painel-timeline` da Cloudflare.

Reúne num só lugar, sem trocar de aba:

- **Início:** vendas da Editora, inscrições dos Eventos, próximos eventos, últimas vendas e inscrições, números do Fiscalize e alertas (reembolsos pedidos, impressos a enviar).
- **Eventos:** o painel `/admin`, a portaria e o site público, abertos dentro do painel.
- **Editora:** o painel `/painel` e a livraria, abertos dentro do painel.
- **Fiscalize:** placar do Robô Fiscalize e atalhos.
- **Site principal:** aviso no topo, ordem e visibilidade dos cartões de destaque, livro e etiquetas, preço da Loja e artigo fixado, com pré-visualização.

## Peças

| Onde | O quê |
|---|---|
| `cockpit/app.html` + `cockpit/worker.src.js` | Fonte do painel. `python3 build.py` gera `worker.js`, o arquivo colado na Cloudflare. |
| `editora-timeline` e `timeline-eventos`: `netlify/functions/cockpit.mjs` | `/api/cockpit`, o resumo de cada sistema. Só responde com o cabeçalho `x-cockpit-token` igual à variável `COCKPIT_TOKEN` da Netlify. |
| `netlify.toml` dos dois sistemas | `frame-ancestors` libera `/admin`, `/staff` e `/painel` para abrir dentro do painel. |
| `novo-site/worker.js` (Worker `site-timeline`) | Lê a configuração do KV `SITE` e serve `/api/config`; aplica o livro escolhido e o artigo fixado. |
| `novo-site/index.html` | Aplica aviso, ordem dos cartões, etiquetas e preço da Loja. |

## Segurança

- **Cloudflare Access** na frente de painel.revistatimeline.com, com login por Google ou código no e-mail, liberado só para os e-mails da política.
- O Worker confere a assinatura do crachá do Access (`ACCESS_TEAM` + `ACCESS_AUD`) em toda requisição; sem ele, nada responde.
- O endereço `*.workers.dev` do Worker deve ficar desligado.
- Os painéis da Editora e dos Eventos continuam pedindo o próprio login dentro do painel (uma vez por navegador).

## Variáveis

| Onde | Nome | Valor |
|---|---|---|
| Worker `painel-timeline` | `ACCESS_TEAM` | nome da equipe do Zero Trust |
| Worker `painel-timeline` | `ACCESS_AUD` (segredo) | AUD tag da aplicação do Access |
| Worker `painel-timeline` | `COCKPIT_TOKEN` (segredo) | um texto aleatório longo (40+ caracteres) |
| Worker `painel-timeline` | `NOMES` (opcional) | `email=Nome,email=Nome` para a saudação |
| Worker `painel-timeline` e `site-timeline` | KV `SITE` | o mesmo namespace nos dois |
| Netlify Editora e Eventos | `COCKPIT_TOKEN` | o mesmo valor do Worker |

## Próxima fase

Os sistemas passam a confiar no crachá do Access (`Cf-Access-Jwt-Assertion`) e o login próprio de cada painel deixa de ser pedido.
