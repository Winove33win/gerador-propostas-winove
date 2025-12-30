<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/13MKrrDmRVJTHWPj08mClrKuS8UUpISFM

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure o backend no arquivo `.env` (use `.env.example` como base), incluindo:
   - `COMMERCIAL_PANEL_USERNAME` e `COMMERCIAL_PANEL_PASSWORD` para proteger o painel em `/comercial-propostas`
   - `REGISTER_INVITE_TOKEN` para exigir token no cadastro (produção)
   - `ALLOW_PUBLIC_REGISTER=true` para liberar cadastro público em produção (ignora o invite)
   - `VITE_REGISTER_INVITE_TOKEN` no front-end para enviar automaticamente o token no cadastro
   - `VITE_API_BASE` no front-end para apontar o backend (ex.: `https://dominio.com/api`). Fallback: `/api`
3. Run the app:
   `npm run dev`

## Cadastro de usuários (invite/public)

- **Cadastro público em produção:** defina `ALLOW_PUBLIC_REGISTER=true` no backend.
- **Cadastro protegido por invite:** defina `REGISTER_INVITE_TOKEN` no backend e envie o token no cadastro:
  - **Payload:** campo `invite_token` dentro do JSON do `POST /api/auth/register`
  - **Header:** `x-invite-token: <TOKEN>`
- **Front-end:** configure `VITE_REGISTER_INVITE_TOKEN` para que o token seja enviado automaticamente (payload + header).
- **Endpoint de login:** `POST /api/auth/login`

## Startup (Plesk)

- **Application Root:** raiz do repositório (ex.: `/agencia.winove.com.br/`)
- **Startup file:** `api.js`
- **Document Root:** `<raiz>/dist`
- **Reverse Proxy / API:** garanta que `/api` (e `/api/*`) seja encaminhado para o Node (backend), não para o `dist/`. Se houver regras de proxy no Plesk/Nginx/Apache, valide que a rota `/api/*` aponte para o processo Node da aplicação.

Depois, execute no **Application Root**:

1. `npm install`
2. `npm run build`

Isso garante que `node_modules/` e `dist/` sejam gerados corretamente.

## Testes de health

### Local

```bash
curl -i http://127.0.0.1:3333/health
curl -i http://127.0.0.1:3333/api/health
```

### Produção (após Plesk apontar o Node como handler do domínio)

```bash
curl -i https://agencia.winove.com.br/health
curl -i https://agencia.winove.com.br/api/health
```
