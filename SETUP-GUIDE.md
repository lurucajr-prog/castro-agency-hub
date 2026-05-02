# Castro Agency Hub — Setup Guide
Follow these steps in order. Takes about 20–30 minutes total.

---

## STEP 1 — Set up your Supabase database

1. Go to **supabase.com** and sign in
2. Click **"New project"** — give it any name (e.g. "castro-agency-hub"), set a strong database password, choose a region close to you
3. Wait ~2 minutes for it to provision
4. In the left sidebar, click **SQL Editor**
5. Open the file `supabase-setup.sql` from this folder (open it in Notepad or any text editor)
6. **BEFORE PASTING** — replace the 7 placeholder emails at the bottom of the file with real emails:
   - `LUIS_EMAIL_HERE` → Luis's actual email
   - `JR_EMAIL_HERE` → Jr's actual email
   - ...and so on for all 7 people
7. Copy the entire SQL file content, paste it into the Supabase SQL Editor, and click **Run**
8. You should see "Success. No rows returned" — that means it worked!

---

## STEP 2 — Create login accounts for each team member

1. In Supabase, go to **Authentication** → **Users** in the left sidebar
2. Click **"Add user"** → **"Create new user"**
3. Enter the same email you used in the SQL above, and set a temporary password (e.g. `CastroAgency2026!`)
4. Repeat for all 7 team members
5. Each person will use their email + password to log in. They can keep the temp password or you can update it later under Authentication → Users

---

## STEP 3 — Get your Supabase credentials

1. In Supabase, click the **gear icon (Settings)** in the left sidebar
2. Click **API**
3. You'll see two values you need — keep this tab open:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **anon / public key** (a long string starting with `eyJ...`)

---

## STEP 4 — Upload the code to GitHub

1. Go to **github.com** and sign in
2. Click the **+** icon (top right) → **New repository**
3. Name it `castro-agency-hub`, set it to **Private**, click **Create repository**
4. On the next screen, click **"uploading an existing file"**
5. Drag and drop ALL the files and folders from this zip into the upload area
   - Make sure to include: `src/` folder, `package.json`, `vite.config.js`, `index.html`
   - **Do NOT upload** `supabase-setup.sql` or this `SETUP-GUIDE.md` (those are just for setup)
6. Click **Commit changes**

---

## STEP 5 — Add your Supabase credentials to GitHub

Before deploying, you need to give Vercel your Supabase URL and key securely.

1. In your GitHub repo, go to **Settings** → **Secrets and variables** → **Actions**
2. You don't need to add them here — you'll add them directly in Vercel (next step)

---

## STEP 6 — Deploy on Vercel

1. Go to **vercel.com** and sign in
2. Click **"Add New Project"**
3. Click **"Import Git Repository"** and connect your GitHub account if prompted
4. Find and select `castro-agency-hub`, click **Import**
5. Before clicking Deploy, click **"Environment Variables"** and add these two:
   - Name: `VITE_SUPABASE_URL` → Value: your Project URL from Step 3
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: your anon key from Step 3
6. Click **Deploy**
7. Wait ~1 minute. Vercel will give you a live URL like `castro-agency-hub.vercel.app` 🎉

---

## STEP 7 — Test it!

1. Open your new URL
2. Log in with one of the emails + passwords you created
3. Try adding a task, logging a referral, sending a chat message
4. Make sure everything saves — if you refresh and the data is still there, it's working!

---

## Sharing with the team

Send each team member:
- The URL (e.g. `https://castro-agency-hub.vercel.app`)
- Their email address
- Their temporary password
- Tell them to bookmark it!

---

## Making changes later

Any time you want to add or change something:
1. Describe what you want to Claude
2. Claude will give you updated code
3. Go to your GitHub repo, find the file, click the pencil icon to edit, paste the new code, and save
4. Vercel will automatically redeploy in ~30 seconds

---

## Need help?

If anything goes wrong during setup, take a screenshot and share it — happy to help troubleshoot!
