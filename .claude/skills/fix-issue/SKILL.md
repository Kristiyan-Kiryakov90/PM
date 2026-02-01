---
name: fix-issue
description: Fix a GitHub issue end-to-end
disable-model-invocation: true
---

# Fix Issue: $ARGUMENTS

## Workflow

1. **Get Issue Details**
   - Use `gh issue view $ARGUMENTS` to get the issue details
   - Understand the problem described

2. **Investigate**
   - Search the codebase for relevant files
   - Understand the current implementation

3. **Implement Fix**
   - Make the necessary changes
   - Follow coding conventions from ai-docs/

4. **Verify**
   - Write tests to verify the fix
   - Run existing tests to ensure no regressions
   - Run linter and type checker

5. **Commit & PR**
   - Create a descriptive commit message
   - Push changes and create a PR
   - Reference the issue in the PR
