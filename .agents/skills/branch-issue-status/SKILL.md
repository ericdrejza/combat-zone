---
name: branch-issue-status
description: Reconcile Combat Zone GitHub issue statuses with work on the current branch compared with master, and create a new issue when branch work is a distinct follow-up to a Done issue.
---

# Branch Issue Status

Use this skill when asked to update Combat Zone project statuses based on the current branch. The repository is `ericdrejza/combat-zone`; the tracking project is [Project 4](https://github.com/users/ericdrejza/projects/4).

## Compare branch work with master

1. Identify the checked-out branch and the best current `master` ref. Prefer `origin/master` when available; fetch it if needed and network access allows. Fall back to local `master` if the remote ref is unavailable, and report that the comparison may use a stale ref. Do not change branches or discard local work.
2. Read commit subjects and bodies in `master..HEAD`. These are the commits on the current branch that are not on master. If the range is empty, there is no branch-only work to mark In Progress.
3. Map commits to issues using explicit issue references first, then commit subject/body meaning. Inspect the existing issue and project item before deciding. A nearby or broadly related feature is not enough to claim work; only map an issue when the commit describes work that advances that issue.

## Status rules

- Work that is on `master` is **Done**. When the compared master commits clearly implement an issue, set its project status to Done.
- Work represented by current-branch commits in `master..HEAD` is **In Progress** when the issue is not Done and the branch commits materially advance it.
- Never move an issue from Done to In Progress just because a branch contains related work. Only do that when the user explicitly overrides this rule or says a recent Done status was a mistake and should be corrected.
- If branch commits represent a distinct new feature or follow-up related to a Done issue, keep the existing issue Done. Search the repository for an existing open issue covering the new work; if none exists, create a focused new issue and add it to Project 4. Avoid duplicates and group tightly related tasks; use a sub-issue when a task is a meaningful part of an existing open parent issue.
- Preserve statuses for issues that the compared commits do not advance. Do not change closed issue state; project status is separate from issue state.

## Update and verify

- Use the existing GitHub CLI authentication. If needed, load `GITHUB_PAT_TOKEN` from the user's shell configuration without printing or exposing the token. Never place a token in command output, files, comments, or issue text.
- Before editing, confirm each target issue exists, is represented in Project 4 (add it only if needed and unique), and is not Done when setting In Progress. Check for a matching open issue before creating a new one.
- Update only the items supported by the commit evidence. Verify the resulting project statuses and report the branch, master ref, issue numbers/titles, and any issues left unchanged because they were Done or ambiguous.
- If GitHub authentication or connectivity prevents a read or update, do not guess or report success; state the specific blocker.
