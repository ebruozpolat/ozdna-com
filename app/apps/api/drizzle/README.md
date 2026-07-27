# drizzle-kit generate output (staging / diff-check only)

`npm run db:generate` writes SQL here. The applied D1 migration remains
`../../migrations/0001_init.sql` — do not copy over it casually. Compare kit
output against 0001 to catch schema drift.
