---
name: Always run npm install before committing
description: After editing package.json, run npm install to update package-lock.json before staging and committing
type: feedback
---

Always run `npm install` after modifying package.json so that package-lock.json is updated before committing.

**Why:** Dave expects package-lock.json to be checked in and stay in sync. Committing package.json without updating the lock file is sloppy.

**How to apply:** Any time you edit package.json (add deps, change fields, bump version), run `npm install` and stage both files together.
