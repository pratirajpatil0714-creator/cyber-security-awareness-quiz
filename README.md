# Cyber-Security Awareness Program - Government Polytechnic, Kolhapur (IT Department)
/ home, /quiz quiz, /admin dashboard (results + quiz open/close schedule).
Setup: Vercel > Storage > Upstash Redis (connect); Settings > Environment Variables > ADMIN_PASSWORD; Redeploy.
Pages: /feedback = separate participant feedback page (linked after the quiz). Certificate shows name + date of participation only.
Admin: /admin (password = ADMIN_PASSWORD). Set quiz open/close time, view results, download CSV, "Allow retake" by roll number.
Rule: once a roll number passes and gets a certificate, it cannot take the quiz again.
Rules: 15 questions, pass = 10/15 (65%), max 2 attempts per roll number, enforced on the server (atomic counter; admin can reset via Allow retake).
Feedback: text only (no rating), empty feedback is rejected (min 5 characters).
Deploy: push this folder to GitHub > Vercel "Add New Project" > import repo (no build settings needed) > Storage > Create Upstash Redis > connect to project > Settings > Environment Variables > ADMIN_PASSWORD > Redeploy. Then open /admin and set the 3-day schedule.

## Latest flow
Home (program info) > /learn (optional basics) > /quiz (15 shuffled questions, pass 10/15, 2 attempts) > /feedback (2 compulsory questions) > /certificate (only for passed + feedback submitted; checked on the server).
College logo: put your logo file at public/logo.png (square PNG, transparent or white background). It appears on every page header and on the certificate badge. Until then a "GPK" badge is shown.
