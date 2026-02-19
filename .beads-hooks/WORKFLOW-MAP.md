# BMAD-Beads Workflow Integration

## Workflow Automation Map

This file maps BMAD workflow stages to Beads task tracking automation.

### State Transitions

| BMAD Workflow | Beads Action | Labels Added | Status Change |
|---------------|--------------|--------------|---------------|
| `create-story` | `bd create` | `story:{key}`, `epic:{num}`, `bmad-workflow` | open |
| `create-story --validate` | `bd label add` | `validated` | - |
| `dev-story` | `bd update` | - | → in_progress |
| `code-review` | `bd label add` | `needs-review`, `review-in-progress` | - |
| `code-review` (pass) | `bd label add/remove` | `review-passed`, remove `review-in-progress` | - |
| `code-review` (fail) | `bd label add/remove` | `review-failed`, remove `review-in-progress` | → open |
| `testarch-automate` | `bd label add` | `tests-generated`, `needs-test-review` | - |
| `testarch-test-review` (pass) | `bd label add/remove` | `tests-reviewed`, remove `needs-test-review` | - |
| `testarch-test-review` (fail) | `bd label add/remove` | `tests-need-fixes`, remove `needs-test-review` | - |
| `qa-automate` | `bd label add` | `qa-automated` | - |
| Story Complete | `bd close` | - | → closed |

### Labels Reference

**Status Labels:**
- `bmad-workflow` - Tracked by BMAD workflow
- `validated` - Story validated and ready for dev
- `review-in-progress` - Code review active
- `review-passed` / `review-failed` - Code review outcome
- `tests-generated` - Tests created
- `needs-test-review` - Tests pending review
- `tests-reviewed` / `tests-need-fixes` - Test review outcome
- `qa-automated` - QA automation complete

**Story/Epic Labels:**
- `story:{key}` - Story identifier (e.g., `story:1-2-user-auth`)
- `epic:{num}` - Epic identifier (e.g., `epic:1`)

### Priority Mapping

| BMAD Priority | Beads Priority |
|---------------|----------------|
| P0 (Critical) | 0 |
| P1 (High) | 1 |
| P2 (Medium) | 2 |
| P3 (Low) | 3 |
| P4 (Nice-to-have) | 4 |

### Dependency Types

BMAD story dependencies map to Beads dependency types:
- **Blocks**: Story A must complete before Story B → `bd dep add trade-xxx trade-yyy --type blocks`
- **Related**: Stories are connected → `bd dep add trade-xxx trade-yyy --type related`
- **Parent-Child**: Epic/Story hierarchy → `bd dep add trade-xxx trade-yyy --type parent-child`

### Quick Commands

```bash
# View all BMAD workflow issues
bd list --label bmad-workflow

# View stories ready for development
bd list --status open --label validated

# View stories in progress
bd list --status in_progress --label bmad-workflow

# View stories needing code review
bd list --label needs-review

# View stories needing test review
bd list --label needs-test-review

# Get next ready story (no blockers)
bd ready --label bmad-workflow

# View workflow status
./.beads-hooks/bmad-integration.sh status
```

### Integration Script

The `.beads-hooks/bmad-integration.sh` script provides automation hooks that can be called from BMAD workflows:

```bash
# After creating a story
./.beads-hooks/bmad-integration.sh create-story "1-2-user-auth" "User Authentication" 1 2

# After validation
./.beads-hooks/bmad-integration.sh validate-story "1-2-user-auth"

# Start development
./.beads-hooks/bmad-integration.sh dev-start "1-2-user-auth" "dev-agent"

# Code review stages
./.beads-hooks/bmad-integration.sh code-review "1-2-user-auth"
./.beads-hooks/bmad-integration.sh code-review-complete "1-2-user-auth" true

# Test automation
./.beads-hooks/bmad-integration.sh testarch-automate "1-2-user-auth"
./.beads-hooks/bmad-integration.sh testarch-test-review "1-2-user-auth" true

# QA automation
./.beads-hooks/bmad-integration.sh qa-automate "1-2-user-auth"

# Complete story
./.beads-hooks/bmad-integration.sh complete-story "1-2-user-auth"
```
