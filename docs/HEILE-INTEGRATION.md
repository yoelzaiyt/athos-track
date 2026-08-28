# Integração Heile (= Jason = BRGPS)

"Heile" (nome usado no brief que motivou este documento) é o **mesmo
fornecedor** documentado em `docs/JASON-INTEGRATION.md` e
`docs/integrations/BRGPS.md` — mesmo token (`HEILE_API_KEY` no `.env` é um
alias do valor já usado em `BRGPS_API_TOKEN`, confirmado com o responsável
do projeto), mesmos endpoints, mesma implementação real
(`server/integrations/brgps/`).

Não existe uma segunda integração/adapter pra "Heile" — `ProviderRegistry.get('heile')`
resolve pro mesmo `BrgpsProvider` que `.get('jason')` e `.get('brgps')`. Ver
`docs/PROVIDER-ARCHITECTURE.md` pra arquitetura completa e evidência da
equivalência.

`GET /providers/heile/health` e `POST /providers/heile/activate` funcionam
— testados ao vivo nesta sessão, devolvendo/afetando o mesmo estado real que
os aliases `jason`/`brgps`.
