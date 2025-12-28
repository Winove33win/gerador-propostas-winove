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
3. Run the app:
   `npm run dev`

## Startup (Plesk)

- **Application Root:** raiz do repositório (ex.: `/agencia.winove.com.br/`)
- **Startup file:** `Backend/server.js`

Depois, execute no **Application Root**:

1. `npm install`
2. `npm run build`

Isso garante que `node_modules/` e `dist/` sejam gerados corretamente.
