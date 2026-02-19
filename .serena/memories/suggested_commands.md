# Suggested Commands

## Task Tracking (Beads)
```bash
bd sync                          # Sync Beads state
bd list                          # List all issues
bd ready --label bmad-workflow   # Get next ready story
bd create "<title>" --type feature --priority 0-4
bd update <id> --status in_progress
bd close <id> --reason "done"
```

## BMAD Workflow
```bash
./.beads-hooks/bmad-integration.sh status       # View workflow status
./.beads-hooks/bmad-integration.sh create-story "1-2-auth" "User Auth" 1 2
./.beads-hooks/bmad-integration.sh validate-story "1-2-auth"
./.beads-hooks/bmad-integration.sh dev-start "1-2-auth"
./.beads-hooks/bmad-integration.sh code-review "1-2-auth"
./.beads-hooks/bmad-integration.sh complete-story "1-2-auth"
```

## Git (Session End)
```bash
git pull --rebase
bd sync
git push
git status  # MUST show "up to date with origin"
```

## Backend (when implemented)
```bash
# Create venv first
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run dev server
uvicorn app.main:app --reload

# Run tests
pytest
pytest --cov=app
```

## Frontend (when implemented)
```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

## System Utilities (Darwin/macOS)
```bash
ls -la          # List files with details
find . -name    # Find files
grep -r         # Search in files
```
