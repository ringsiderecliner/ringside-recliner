# GitHub setup for Ringside Recliner

This project is ready for GitHub and includes an automatic GitHub Pages deployment workflow.

## 1. Protect the anonymous identity first

Use a separate pseudonymous GitHub account for this blog. A suitable public identity would be:

- Display name: `The Recliner`
- Repository name: `ringside-recliner`
- No personal photograph, biography, workplace, location, or links to personal accounts

In GitHub, open **Settings → Emails** and:

1. Enable **Keep my email addresses private**.
2. Copy the GitHub-provided `noreply` email address shown there.
3. Enable **Block command line pushes that expose my email**, if available.

The account still needs a real private email address for sign-in and recovery, but it does not need to appear publicly.

## 2. Create the empty repository

On GitHub, create a repository named:

```text
ringside-recliner
```

For the first writing test, either:

- choose **Private**, then change it to Public when you are ready to publish; or
- choose **Public** immediately if the pseudonymous account is ready and you want GitHub Pages now.

Do **not** add a README, `.gitignore`, or licence when creating it. Those files already exist in this project.

## 3. Push this project from Windows

Open PowerShell inside the extracted `ringside-recliner-v0_7` folder, then run the following commands. Replace the two placeholders first.

```powershell
git init -b main
git config user.name "The Recliner"
git config user.email "YOUR_GITHUB_NOREPLY_EMAIL"
git add .
git commit -m "Ringside Recliner v0.7"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/ringside-recliner.git
git push -u origin main
```

The `git config` commands above apply only to this repository, so they do not change the identity used by your other Git projects.

If `git` is not recognised, install Git for Windows and reopen PowerShell.

## 4. Turn on GitHub Pages

When the repository is public, open:

**Repository → Settings → Pages**

Under **Build and deployment**, set **Source** to **GitHub Actions**.

The included workflow at `.github/workflows/deploy-pages.yml` will then:

1. build the Markdown content;
2. create a clean `_site` bundle;
3. publish the website whenever `main` is pushed.

The first deployment can take a few minutes. Its status appears in the repository's **Actions** tab.

## 5. Normal publishing routine

Preview locally:

```powershell
npm start
```

Build and commit a finished change:

```powershell
npm run build
git add .
git commit -m "Add Raw notes for 20 July 2026"
git push
```

The push triggers the website deployment automatically.

## Privacy checklist before every push

- Confirm the Git author is `The Recliner` with `git log -1 --format="%an <%ae>"`.
- Remove GPS/device metadata from photographs before committing them.
- Crop out browser profiles, account names, notifications, tabs, and local file paths from screenshots.
- Never commit passwords, access tokens, private emails, or drafts containing real names.
- Check image rights and attribution before publishing.
