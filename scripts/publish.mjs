// Publishes a post written in Linear. This is what an agent runs when asked
// to "publish this".
//
//   node scripts/publish.mjs <document URL or title>              publish and deploy
//   node scripts/publish.mjs --unpublish <document URL or title>  take it down and deploy
//   node scripts/publish.mjs --deploy                             redeploy only (after
//                                                                 editing a live post)
//   add --no-deploy to move the document without deploying yet
//
// Needs LINEAR_API_KEY (environment or .env), and to deploy, either the gh CLI
// signed in or GH_TOKEN with Actions write access to the repo.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findDocument, moveDocument, PUBLISHED_PROJECT, DRAFTS_PROJECT } from '../lib/linear.mjs';
import { linearMeta } from '../lib/posts.mjs';

try { process.loadEnvFile('.env'); } catch {}

const REPO = 'Shirazik/khs-website';
const WORKFLOW = 'deploy.yml';
const SITE = 'https://kareemshirazi.com';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const ref = args.filter((a) => !a.startsWith('--')).join(' ').trim();

async function deploy() {
  if (process.env.GH_TOKEN) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ ref: 'main' }),
    });
    if (!res.ok) throw new Error(`GitHub: couldn't start the deploy (${res.status} ${await res.text()})`);
  } else {
    await promisify(execFile)('gh', ['workflow', 'run', WORKFLOW, '--repo', REPO, '--ref', 'main']);
  }
  console.log(`Deploy started: https://github.com/${REPO}/actions/workflows/${WORKFLOW}`);
}

if (flag('--deploy')) {
  await deploy();
} else {
  if (!ref) {
    console.error('Usage: node scripts/publish.mjs [--unpublish] [--no-deploy] <Linear document URL or title>');
    process.exit(1);
  }
  const doc = await findDocument(ref);
  const target = flag('--unpublish') ? DRAFTS_PROJECT : PUBLISHED_PROJECT;
  const { slug } = linearMeta(doc); // also fails early on bad front matter
  if (doc.project?.name === target) {
    console.log(`"${doc.title}" is already in ${target}.`);
  } else {
    await moveDocument(doc, target);
    console.log(`Moved "${doc.title}" to ${target}.`);
  }
  if (!flag('--no-deploy')) await deploy();
  if (target === PUBLISHED_PROJECT) console.log(`Live in a minute or two at ${SITE}/posts/${slug}/`);
}
