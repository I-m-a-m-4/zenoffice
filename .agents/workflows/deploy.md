---
description: Automatically deploy changes to GitHub for continuous delivery
---

To ensure every change we make is immediately live, I will follow this sequence after completing a set of logic or UI fixes.

// turbo-all

1. Add all modified files to the staging area
   `git add .`

2. Commit the changes with a descriptive message
   `git commit -m "Auto-deploy: System configuration update"`

3. Push the changes from the main repository
   `git push origin main`

Once pushed, Vercel will automatically detect the commit and trigger a production build.
