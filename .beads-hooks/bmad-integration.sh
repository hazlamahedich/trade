#!/bin/bash
# BMAD-Beads Integration Hooks
# Maps BMAD workflows to Beads task tracking

set -e

BEADS_CMD="bd"

# BMAD Workflow to Beads State Mapping:
# create-story -> creates issue with status "open", priority from epic
# create-story --validate -> adds "validated" label
# dev-story -> sets status to "in_progress", assigns to dev
# code-review -> adds "needs-review" label
# testarch-automate -> adds "needs-tests" label
# testarch-test-review -> adds "tests-reviewed" label
# qa-automate -> adds "qa-complete" label
# story done -> closes issue

# Create issue from story
bmad_create_story() {
    local story_key="$1"
    local story_title="$2"
    local epic_num="$3"
    local priority="${4:-2}"
    
    # Create Beads issue
    local issue_id=$($BEADS_CMD create "$story_title" \
        --type feature \
        --priority "$priority" \
        --label "story:$story_key" \
        --label "epic:$epic_num" \
        --label "bmad-workflow" \
        --json 2>/dev/null | jq -r '.id')
    
    echo "$issue_id"
}

# Validate story (add validated label)
bmad_validate_story() {
    local story_key="$1"
    local issue_id=$($BEADS_CMD list --label "story:$story_key" --json 2>/dev/null | jq -r '.[0].id')
    
    if [ -n "$issue_id" ] && [ "$issue_id" != "null" ]; then
        $BEADS_CMD label add "$issue_id" "validated"
        echo "✓ Story $story_key validated (Beads: $issue_id)"
    fi
}

# Start development
bmad_dev_start() {
    local story_key="$1"
    local assignee="${2:-dev-agent}"
    local issue_id=$($BEADS_CMD list --label "story:$story_key" --json 2>/dev/null | jq -r '.[0].id')
    
    if [ -n "$issue_id" ] && [ "$issue_id" != "null" ]; then
        $BEADS_CMD update "$issue_id" --status in_progress --assignee "$assignee"
        echo "✓ Development started for $story_key (Beads: $issue_id)"
    fi
}

# Code review stage
bmad_code_review() {
    local story_key="$1"
    local issue_id=$($BEADS_CMD list --label "story:$story_key" --json 2>/dev/null | jq -r '.[0].id')
    
    if [ -n "$issue_id" ] && [ "$issue_id" != "null" ]; then
        $BEADS_CMD label add "$issue_id" "needs-review"
        $BEADS_CMD label add "$issue_id" "review-in-progress"
        echo "✓ Code review started for $story_key (Beads: $issue_id)"
    fi
}

# Code review complete
bmad_code_review_complete() {
    local story_key="$1"
    local passed="${2:-true}"
    local issue_id=$($BEADS_CMD list --label "story:$story_key" --json 2>/dev/null | jq -r '.[0].id')
    
    if [ -n "$issue_id" ] && [ "$issue_id" != "null" ]; then
        $BEADS_CMD label remove "$issue_id" "review-in-progress" 2>/dev/null || true
        if [ "$passed" = "true" ]; then
            $BEADS_CMD label add "$issue_id" "review-passed"
            echo "✓ Code review passed for $story_key (Beads: $issue_id)"
        else
            $BEADS_CMD label add "$issue_id" "review-failed"
            $BEADS_CMD update "$issue_id" --status open
            echo "✗ Code review failed for $story_key - needs fixes (Beads: $issue_id)"
        fi
    fi
}

# Test automation stage
bmad_testarch_automate() {
    local story_key="$1"
    local issue_id=$($BEADS_CMD list --label "story:$story_key" --json 2>/dev/null | jq -r '.[0].id')
    
    if [ -n "$issue_id" ] && [ "$issue_id" != "null" ]; then
        $BEADS_CMD label add "$issue_id" "tests-generated"
        $BEADS_CMD label add "$issue_id" "needs-test-review"
        echo "✓ Tests generated for $story_key (Beads: $issue_id)"
    fi
}

# Test review stage
bmad_testarch_test_review() {
    local story_key="$1"
    local passed="${2:-true}"
    local issue_id=$($BEADS_CMD list --label "story:$story_key" --json 2>/dev/null | jq -r '.[0].id')
    
    if [ -n "$issue_id" ] && [ "$issue_id" != "null" ]; then
        $BEADS_CMD label remove "$issue_id" "needs-test-review" 2>/dev/null || true
        if [ "$passed" = "true" ]; then
            $BEADS_CMD label add "$issue_id" "tests-reviewed"
            echo "✓ Tests reviewed for $story_key (Beads: $issue_id)"
        else
            $BEADS_CMD label add "$issue_id" "tests-need-fixes"
            echo "✗ Tests need fixes for $story_key (Beads: $issue_id)"
        fi
    fi
}

# QA automation stage
bmad_qa_automate() {
    local story_key="$1"
    local issue_id=$($BEADS_CMD list --label "story:$story_key" --json 2>/dev/null | jq -r '.[0].id')
    
    if [ -n "$issue_id" ] && [ "$issue_id" != "null" ]; then
        $BEADS_CMD label add "$issue_id" "qa-automated"
        echo "✓ QA automation complete for $story_key (Beads: $issue_id)"
    fi
}

# Complete story
bmad_complete_story() {
    local story_key="$1"
    local issue_id=$($BEADS_CMD list --label "story:$story_key" --json 2>/dev/null | jq -r '.[0].id')
    
    if [ -n "$issue_id" ] && [ "$issue_id" != "null" ]; then
        $BEADS_CMD close "$issue_id" --reason "BMAD workflow complete"
        echo "✓ Story $story_key completed (Beads: $issue_id closed)"
    fi
}

# Get next ready story
bmad_next_ready() {
    $BEADS_CMD ready --label "bmad-workflow" --json 2>/dev/null | jq -r '.[0] | "\(.id) - \(.title)"' 2>/dev/null || echo "No ready stories"
}

# Show workflow status
bmad_status() {
    echo "📊 BMAD-Beads Workflow Status"
    echo "============================="
    echo ""
    echo "📋 Ready for Development:"
    $BEADS_CMD list --status open --label "bmad-workflow" --label "validated" 2>/dev/null || echo "  None"
    echo ""
    echo "🔄 In Progress:"
    $BEADS_CMD list --status in_progress --label "bmad-workflow" 2>/dev/null || echo "  None"
    echo ""
    echo "🔍 Needs Review:"
    $BEADS_CMD list --label "needs-review" 2>/dev/null || echo "  None"
    echo ""
    echo "🧪 Needs Test Review:"
    $BEADS_CMD list --label "needs-test-review" 2>/dev/null || echo "  None"
}

# Main command dispatcher
case "$1" in
    create-story)
        bmad_create_story "$2" "$3" "$4" "$5"
        ;;
    validate-story)
        bmad_validate_story "$2"
        ;;
    dev-start)
        bmad_dev_start "$2" "$3"
        ;;
    code-review)
        bmad_code_review "$2"
        ;;
    code-review-complete)
        bmad_code_review_complete "$2" "$3"
        ;;
    testarch-automate)
        bmad_testarch_automate "$2"
        ;;
    testarch-test-review)
        bmad_testarch_test_review "$2" "$3"
        ;;
    qa-automate)
        bmad_qa_automate "$2"
        ;;
    complete-story)
        bmad_complete_story "$2"
        ;;
    next-ready)
        bmad_next_ready
        ;;
    status)
        bmad_status
        ;;
    *)
        echo "BMAD-Beads Integration"
        echo ""
        echo "Usage: bmad-integration.sh <command> [args]"
        echo ""
        echo "Commands:"
        echo "  create-story <key> <title> <epic> [priority]  Create story issue"
        echo "  validate-story <key>                           Mark story as validated"
        echo "  dev-start <key> [assignee]                     Start development"
        echo "  code-review <key>                              Start code review"
        echo "  code-review-complete <key> [passed]            Complete code review"
        echo "  testarch-automate <key>                        Generate tests"
        echo "  testarch-test-review <key> [passed]            Review tests"
        echo "  qa-automate <key>                              Run QA automation"
        echo "  complete-story <key>                           Close completed story"
        echo "  next-ready                                     Get next ready story"
        echo "  status                                         Show workflow status"
        ;;
esac
