# Task Completion Checklist

## MANDATORY Workflow (Before Ending Session)

1. **File issues for remaining work** - Create Beads issues for follow-up items
   ```bash
   bd create "<title>" --type feature --priority 0-4
   ```

2. **Run quality gates** (if code changed)
   - Backend: `pytest`, linting
   - Frontend: `npm run lint`, `npm run test`, `npm run build`

3. **Update issue status**
   ```bash
   bd update <id> --status in_progress  # or completed
   bd label add <id> <label>
   ```

4. **PUSH TO REMOTE** (MANDATORY)
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```

5. **Clean up**
   - Clear stashes: `git stash drop`
   - Prune remote branches: `git remote prune origin`

6. **Verify**
   - All changes committed AND pushed
   - No stuck in-progress items: `bd list --status in_progress`

7. **Hand off**
   - Provide context for next session
   - Update story files in `_bmad-output/implementation-artifacts/`

## Critical Rules
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing
- If push fails, resolve and retry until it succeeds
