# Git workflow

The repository uses `main`, which tracks `origin/main` at `https://github.com/dinukahansana/Zestora.git`. The first commit, `7ed1063`, added `.gitignore` and was pushed after approval.

Git records local snapshots called commits. Staging selects the files for the next snapshot. A branch points to the latest commit in a line of work. GitHub hosts a remote copy. Pushing publishes local commits and pulling brings remote changes into the local branch.

## Milestone routine

~~~sh
git status --short --branch
git diff
git remote -v
~~~

Read untracked files separately because `git diff` only shows tracked changes. Run the relevant checks and confirm that local environment files, dependencies, and build outputs are ignored. Stage explicit paths after reviewing new files, then inspect `git diff --cached --check` and `git diff --cached`.

Use a short Conventional Commit message for each milestone, for example `chore: scaffold Zestora monorepo`. Use a focused feature branch when a change needs review or isolation. Push to the intended branch only after the project owner's explicit approval. Windows uses browser-based Git Credential Manager if GitHub asks for authentication.

## Phase 0 commit commands

After reviewing the scaffold, these commands select and commit its files.

~~~sh
git add -- .env.example README.md package.json package-lock.json apps automation docs
git diff --cached --check
git diff --cached --stat
git diff --cached
git commit -m "chore: scaffold Zestora monorepo"
~~~

After explicit push approval, publish the commit with `git push origin main`.
