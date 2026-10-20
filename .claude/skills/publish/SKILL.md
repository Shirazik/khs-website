---
name: publish
description: Publish, unpublish or redeploy a post on kareemshirazi.com that is written as a Linear document. Use when the user says "publish this", "publish <post>", "take <post> down", or "redeploy the site".
---

# Publish a post from Linear

Posts are Linear documents. A document in the **Website: Published** project is live;
one in **Website: Drafts** is not. Publishing moves the document and redeploys the site.

1. Identify the document: a Linear document URL the user gave, or its exact title. If
   it's ambiguous, ask which one.
2. Before publishing, read the document (Linear connector, or ask the user to paste it)
   and check the site's anonymising rule: no client names, and business figures written
   as XX. Stop and point out anything that breaks it; the repo and site are public.
3. Run, from the repo root:

   ```bash
   node scripts/publish.mjs "<document URL or title>"
   ```

   - Take it down: `node scripts/publish.mjs --unpublish "<document URL or title>"`
   - The post is already live and was edited: `node scripts/publish.mjs --deploy`

   It needs `LINEAR_API_KEY` in the environment or in the gitignored `.env` file. If
   it's missing, ask the user to add it themselves; never ask for the key in chat.
4. Watch the deploy: `gh run list --repo Shirazik/khs-website --workflow deploy.yml --limit 1`,
   then `gh run watch <id> --repo Shirazik/khs-website --exit-status`.
5. Confirm the post URL the script printed returns 200, then reply with that link. If
   the run failed, show the failing step's log (`gh run view <id> --log-failed`).
