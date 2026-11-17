# Public demo snapshot

`snapshot.json` is a sanitized, allowlisted export of market view-models for the
read-only public deployment (`CIT_PUBLIC_DEMO=1`).

Regenerate from the local SQLite database:

```bash
unset CIT_PUBLIC_DEMO
npm run export:public-demo
```

Do not place secrets, raw SQLite files, or admin configuration here.
