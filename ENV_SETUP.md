# Environment Variables Setup

## Required Variables

This project requires the following environment variables:

- `VITE_SUPABASE_URL` - Your Supabase project URL (e.g., `https://your-project-id.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase publishable key (starts with `sb_publishable_`)

## Local Development

1. Create a `.env` file in the root directory
2. Add your variables:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
```

## Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables (type them manually, don't copy-paste to avoid hidden characters):
   - **Name**: `VITE_SUPABASE_URL` (type manually, all uppercase, no spaces)
   - **Value**: `https://sudujoijxndsohgfxoad.supabase.co`
   - **Environments**: Select Production, Preview, and Development
   
   - **Name**: `VITE_SUPABASE_PUBLISHABLE_KEY` (type manually, all uppercase, no spaces)
   - **Value**: `sb_publishable_AgXkKOYRw-NqZzPXwxz59g_IkVYjERg`
   - **Environments**: Select Production, Preview, and Development

4. Click **Save** for each variable
5. Redeploy your application

### Troubleshooting Vercel Variable Names

If you get "invalid characters" error:
- **Type the variable name manually** (don't copy-paste)
- Ensure it's **all uppercase**: `VITE_SUPABASE_URL`
- **No spaces** before or after the name
- **No special characters** except underscores
- Make sure you're in the correct project settings

## Getting Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Publishable key** (anon/public key) → `VITE_SUPABASE_PUBLISHABLE_KEY`

