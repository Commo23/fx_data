# Environment Variables Setup

## Required Variables

This project requires the following environment variable:

- `VITE_API_URL` - Your Node.js API server URL (e.g., `https://your-server.up.railway.app/api` or `http://localhost:3001/api` for local development)

## Local Development

1. Start the Node.js server locally:
   ```bash
   npm run dev:server
   ```
   The server will run on `http://localhost:3001` by default.

2. Create a `.env` file in the root directory (optional for local development):
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```
   If not set, it defaults to `http://localhost:3001/api`.

## Vercel Deployment

1. Deploy your Node.js server on Railway (or Render) first
2. Get your server URL (e.g., `https://your-server.up.railway.app`)
3. Go to your Vercel project dashboard
4. Navigate to **Settings** → **Environment Variables**
5. Add the following variable:
   - **Name**: `VITE_API_URL` (type manually, all uppercase, no spaces)
   - **Value**: `https://your-server.up.railway.app/api` (replace with your actual server URL)
   - **Environments**: Select Production, Preview, and Development
6. Click **Save**
7. Redeploy your application

### Troubleshooting Vercel Variable Names

If you get "invalid characters" error:
- **Type the variable name manually** (don't copy-paste)
- Ensure it's **all uppercase**: `VITE_API_URL`
- **No spaces** before or after the name
- **No special characters** except underscores
- Make sure you're in the correct project settings

