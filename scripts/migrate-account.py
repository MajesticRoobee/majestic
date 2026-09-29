#!/usr/bin/env python3
"""Copy the shop from the old Cloudflare account into the new one.

Cloudflare cannot move a D1 database or an R2 bucket between accounts, so the
move is a copy: the database is exported from the old account, reshaped, and
imported into the new one, and every product image is re-uploaded to the new
bucket. `.github/workflows/migrate-account.yml` runs the steps in order:

  check-target [--replace]   refuse to import over data unless told to, and
                             when told to, empty the new database first
  prepare <export.sql> <dir> reshape the export (below) into batches of SQL,
                             list the images to upload and the expected row
                             counts, and replay the batches locally so a
                             problem is named here, before the new account
                             is touched
  copy-media <dir>           put every image into the new account's bucket
  import <dir>               load the batches into the new database
  verify <dir>               compare the new database's row counts with the
                             export's, table by table

**Why the export is reshaped rather than imported as-is.** 174 images still
live inside the old database as BLOBs (see worker/media.js); only the newer 48
are in R2. Rather than carry those BLOBs across, `prepare` lifts them out, and
`copy-media` puts them in the new bucket, so the new database arrives without
them and every image serves from R2 from day one. That is the same end state
the admin's "move images to R2" action produces, reached without touching the
old account. It also keeps each import statement small. It uses Python
because its sqlite3 module can load the export, rewrite it and replay it in
memory with foreign keys enforced. Node has no equivalent built in.

Every remote wrangler call runs from the work directory, which has no wrangler
config, so a database is looked up by *name* in whichever account the
credentials belong to. Run from the repo, wrangler.jsonc would map the name to
the new account's database id, even for the old-account export.

Credentials: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID are the new account,
OLD_CLOUDFLARE_API_TOKEN / OLD_CLOUDFLARE_ACCOUNT_ID the old one.
OLD_WRANGLER_ARGS / NEW_WRANGLER_ARGS (default "--remote") exist so the whole
thing can be rehearsed against local state instead.
"""
import json
import os
import re
import shlex
import sqlite3
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

DB_NAME = "majestic-roobee"
BUCKET = "majesticroobee"
# Must match putMedia in worker/media.js, so a copied image is cached exactly
# like one uploaded through the admin.
CACHE_CONTROL = "public, max-age=31536000, immutable"

ROOT = Path(__file__).resolve().parent.parent
WRANGLER = os.environ.get("WRANGLER") or str(ROOT / "node_modules" / ".bin" / "wrangler")


def side_env(side):
    env = dict(os.environ)
    if side == "old":
        env["CLOUDFLARE_API_TOKEN"] = os.environ.get("OLD_CLOUDFLARE_API_TOKEN", "")
        env["CLOUDFLARE_ACCOUNT_ID"] = os.environ.get("OLD_CLOUDFLARE_ACCOUNT_ID", "")
    return env


def side_args(side):
    return shlex.split(os.environ.get(f"{side.upper()}_WRANGLER_ARGS", "--remote"))


def wrangler(side, args, cwd, attempts=3, wait=2):
    """Run wrangler against one account; retry transient failures."""
    cmd = [WRANGLER, *args, *side_args(side)]
    for attempt in range(1, attempts + 1):
        r = subprocess.run(cmd, cwd=cwd, env=side_env(side), capture_output=True, text=True)
        if r.returncode == 0:
            return r.stdout
        if attempt == attempts:
            # --json failures land on stdout, the rest on stderr.
            raise RuntimeError(f"wrangler {args[0]} {args[1]} failed:\n{scrub(r.stdout + r.stderr)[-2000:]}")
        time.sleep(wait * attempt)


def query_new_each(statements, cwd, batch=25):
    """Run statements against the new database; one result list per statement."""
    results = []
    for i in range(0, len(statements), batch):
        sql = "; ".join(statements[i:i + batch])
        out = wrangler("new", ["d1", "execute", DB_NAME, "--json", "--command", sql], cwd)
        # The JSON starts on the first line that opens with "[" — a notice
        # printed ahead of it can carry "[" inside a colour code.
        start = re.search(r"^\[", out, re.M).start()
        results += [r["results"] for r in json.loads(out[start:])]
    return results


def query_new(sql, cwd):
    return query_new_each([sql], cwd)[0]


def user_tables(rows):
    """Table names from either a sqlite3 cursor (tuples) or a D1 result (dicts)."""
    return [r[0] if isinstance(r, tuple) else r["name"] for r in rows]


TABLES_SQL = (
    "SELECT name FROM sqlite_master WHERE type='table' "
    "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name"
)


def check_target(replace, workdir):
    workdir.mkdir(parents=True, exist_ok=True)
    tables = user_tables(query_new(TABLES_SQL, workdir))
    if not tables:
        print("New database is empty — ready to import.")
        return
    orders = query_new('SELECT COUNT(*) AS n FROM "orders"', workdir)[0]["n"] if "orders" in tables else 0
    print(f"New database already has {len(tables)} tables and {orders} orders.")
    if not replace:
        sys.exit(
            "Refusing to import over it. Re-run with 'Replace what is in the new database' ticked "
            "if everything in it should be thrown away and replaced by the old account's data."
        )
    # Children before parents. Dropping a table deletes its rows first, and
    # deleting a row that references a table already gone fails outright
    # ("no such table: main.locations"), deferred foreign keys or not.
    fks = query_new_each([f'PRAGMA foreign_key_list("{t}")' for t in tables], workdir)
    referenced_by = {t: set() for t in tables}
    for child, keys in zip(tables, fks):
        for k in keys:
            if k["table"] in referenced_by and k["table"] != child:
                referenced_by[k["table"]].add(child)
    order, dropped = [], set()
    while len(order) < len(tables):
        ready = [t for t in tables if t not in dropped and referenced_by[t] <= dropped]
        if not ready:  # a cycle; let the deferred check settle it at commit
            ready = [t for t in tables if t not in dropped]
        order += ready
        dropped.update(ready)
    # One batch, one transaction: if any DROP fails, nothing is dropped.
    err = run_batch(as_sql([f'DROP TABLE IF EXISTS "{t}";' for t in order]), workdir)
    if err:
        sys.exit(f"Couldn't empty the new database:\n{err[-1500:]}")
    left = user_tables(query_new(TABLES_SQL, workdir))
    if left:
        sys.exit(f"Reset left tables behind: {left}")
    print(f"Emptied the new database ({len(tables)} tables dropped).")


# D1 refuses any SQL string over 100 KB — and when several statements are sent
# together, that is the whole string. The shop writes long values through
# bound parameters, which don't count, but a migration is literal SQL, so a
# value the shop stored happily can still be too long. Rows past the line
# have their long text built up in a scratch table a piece at a time, and the
# INSERT reads it from there. Batches of statements stay under the same line.
LIMIT = 90_000
# Characters per piece: 4-byte UTF-8, doubled by hex, still under the limit.
PIECE = 10_000
PARTS = "_migrate_parts"
DEFER = "PRAGMA defer_foreign_keys = TRUE;"


def hex_text(value):
    """A text value as hex bytes. No quotes, semicolons, keywords or comment
    markers can then appear in the data — nothing a SQL splitter could trip on."""
    return f"CAST(X'{value.encode().hex()}' AS TEXT)"


def parent_first(conn, tables):
    """Tables ordered so every table comes after the tables it references.

    Each batch is its own transaction with its own foreign-key check, so a
    child row must never arrive in an earlier batch than its parent."""
    refs = {t: {r[2] for r in conn.execute(f'PRAGMA foreign_key_list("{t}")')} - {t} for t in tables}
    order, done = [], set()
    while len(order) < len(tables):
        ready = [t for t in tables if t not in done and refs[t] & set(tables) <= done]
        if not ready:  # a cycle: fall back to creation order for the rest
            ready = [t for t in tables if t not in done]
        order += ready
        done.update(ready)
    return order


def dump(conn):
    """The prepared database as statements, grouped into batches under LIMIT.

    Every table first (creation order), then scratch pieces for any long
    values, then every row (parents before children), then the AUTOINCREMENT
    counters, then indexes, triggers and views. Text travels as hex; numbers,
    NULLs and BLOBs as SQLite's own literals.
    """
    master = conn.execute(
        "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL "
        "AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY rowid").fetchall()
    tables = [n for t, n, _ in master if t == "table"]
    rows, parts, key = [], [], 0
    for name in parent_first(conn, tables):
        cols = [r[1] for r in conn.execute(f'PRAGMA table_info("{name}")')]
        collist = ", ".join(f'"{c}"' for c in cols)
        # typeof + raw value per column: text is re-encoded here, the rest
        # keeps SQLite's own quote() literal.
        fields = ", ".join(f'typeof("{c}"), "{c}", quote("{c}")' for c in cols)
        for rec in conn.execute(f'SELECT {fields} FROM "{name}"'):
            lits = []
            for i in range(0, len(rec), 3):
                kind, raw, quoted = rec[i:i + 3]
                lits.append(hex_text(raw) if kind == "text" else quoted)
            stmt = f'INSERT INTO "{name}" ({collist}) VALUES({", ".join(lits)});'
            if len(stmt.encode()) > LIMIT:
                for i, lit in enumerate(lits):
                    raw = rec[3 * i + 1]
                    if len(lit) <= LIMIT // 4:
                        continue
                    if rec[3 * i] != "text":
                        sys.exit(f"A {cols[i]} value in {name} is too large to copy and is not text.")
                    key += 1
                    pieces = [raw[j:j + PIECE] for j in range(0, len(raw), PIECE)]
                    parts.append(f"INSERT INTO {PARTS} (k, v) VALUES ({key}, {hex_text(pieces[0])});")
                    parts += [f"UPDATE {PARTS} SET v = v || {hex_text(p)} WHERE k = {key};" for p in pieces[1:]]
                    lits[i] = f"(SELECT v FROM {PARTS} WHERE k = {key})"
                stmt = f'INSERT INTO "{name}" ({collist}) VALUES({", ".join(lits)});'
                if len(stmt.encode()) > LIMIT:
                    sys.exit(f"A row in {name} is too large to copy even with its long values split.")
            rows.append(stmt)
    seq = []
    if conn.execute("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").fetchone():
        seq = ["DELETE FROM sqlite_sequence;"] + [
            f"INSERT INTO sqlite_sequence (name, seq) VALUES({hex_text(n)}, {v});"
            for n, v in conn.execute("SELECT name, seq FROM sqlite_sequence")]
    if parts:
        print(f"{key} long values split into {len(parts)} pieces to fit D1's statement limit.")
    statements = [
        *[sql + ";" for t, _, sql in master if t == "table"],
        *([f"CREATE TABLE {PARTS} (k INTEGER PRIMARY KEY, v TEXT NOT NULL);"] if parts else []),
        *parts, *rows, *seq,
        *[sql + ";" for t, _, sql in master if t != "table"],
        *([f"DROP TABLE {PARTS};"] if parts else []),
    ]
    batches, current = [], []
    for stmt in statements:
        if current and len(" ".join([DEFER, *current, stmt]).encode()) > LIMIT:
            batches.append(current)
            current = []
        current.append(stmt)
    batches.append(current)
    return batches


def as_sql(batch):
    # Deferred per batch: each batch is a transaction of its own, and the
    # setting lasts only for that transaction.
    return " ".join([DEFER, *batch])


def preflight(batches):
    """Replay the batches into a scratch SQLite, each as its own transaction
    with foreign keys enforced — exactly how D1 will run them — so a problem
    is named here, before anything touches the new account. Names tables and
    columns only, never values: the Actions log of a public repo is public.
    """
    check = sqlite3.connect(":memory:", isolation_level=None)
    check.execute("PRAGMA foreign_keys = ON")
    for b, batch in enumerate(batches):
        check.execute("BEGIN")
        check.execute(DEFER)
        for stmt in batch:
            try:
                check.execute(stmt)
            except sqlite3.Error as e:
                sys.exit(f"Batch {b + 1}: {describe(stmt)} fails: {e}")
        try:
            check.execute("COMMIT")
        except sqlite3.IntegrityError:
            broken = {}
            for child, _, parent, _ in check.execute("PRAGMA foreign_key_check"):
                broken[(child, parent)] = broken.get((child, parent), 0) + 1
            sys.exit("The old data has rows pointing at rows that no longer exist, which D1 refuses:\n"
                     + "\n".join(f"  {c} → {p}: {k} rows" for (c, p), k in sorted(broken.items())))
    total = sum(len(b) for b in batches)
    print(f"Checked locally: {total} statements in {len(batches)} batches, foreign keys intact.")


def describe(stmt):
    """What a statement does, without any of its data."""
    m = re.match(r'\s*(INSERT INTO|CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX|UPDATE|DELETE FROM|DROP TABLE)\s+"?([\w]+)"?', stmt, re.I)
    return f"{m.group(1).upper()} {m.group(2)}" if m else stmt.split()[0].upper()


def scrub(text):
    """Error text safe for a public log: no links, no hex-encoded data."""
    text = re.sub(r"https?://\S+", "<link removed>", text)
    return re.sub(r"X'[0-9A-Fa-f]*'", "X'…'", text)


def prepare(export_sql, workdir):
    workdir.mkdir(parents=True, exist_ok=True)
    blobs = workdir / "blobs"
    blobs.mkdir(exist_ok=True)

    conn = sqlite3.connect(":memory:")
    conn.executescript(Path(export_sql).read_text())
    # Cloudflare's own bookkeeping; the new database has its own and refuses
    # writes to these names.
    for (t,) in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '\\_cf\\_%' ESCAPE '\\'").fetchall():
        conn.execute(f'DROP TABLE "{t}"')

    # Images already in the old bucket: copy object to object.
    copy = [{"id": i, "mime": m} for i, m in conn.execute(
        "SELECT id, mime FROM media WHERE storage='r2' ORDER BY id")]
    # Images still inside the old database: lift the bytes out to files, and
    # mark the rows as R2-backed with the BLOB emptied — exactly how
    # moveMediaToR2 in worker/media.js leaves a row it has moved.
    upload = []
    for n, (i, m, b) in enumerate(conn.execute(
            "SELECT id, mime, bytes FROM media WHERE storage='d1' AND length(bytes) > 0 ORDER BY id").fetchall()):
        f = blobs / f"{n}.bin"
        f.write_bytes(b)
        upload.append({"id": i, "mime": m, "file": str(f)})
    conn.execute("UPDATE media SET storage='r2', bytes=X'' WHERE storage='d1' AND length(bytes) > 0")
    conn.commit()

    batches = dump(conn)
    preflight(batches)
    (workdir / "batches.json").write_text(json.dumps(batches))

    counts = {t: conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
              for t in user_tables(conn.execute(TABLES_SQL).fetchall())}
    (workdir / "counts.json").write_text(json.dumps(counts, indent=1))
    (workdir / "media.json").write_text(json.dumps({"copy": copy, "upload": upload}, indent=1))

    size = sum(len(as_sql(b).encode()) for b in batches)
    print(f"Prepared {len(counts)} tables, {sum(counts.values())} rows, {size / 1e6:.1f} MB of SQL.")
    # Totals only: the Actions log of a public repo is public.
    print(f"Images: {len(upload)} to lift out of the database, {len(copy)} to copy bucket to bucket.")


def copy_media(workdir):
    plan = json.loads((workdir / "media.json").read_text())
    tmp = workdir / "copied"
    tmp.mkdir(exist_ok=True)

    def put(item, path):
        wrangler("new", ["r2", "object", "put", f"{BUCKET}/{item['id']}", "--file", str(path),
                         "--content-type", item["mime"], "--cache-control", CACHE_CONTROL], workdir)

    def upload(item):
        put(item, item["file"])
        return None

    def copy(numbered):
        n, item = numbered
        path = tmp / f"{n}.bin"
        try:
            wrangler("old", ["r2", "object", "get", f"{BUCKET}/{item['id']}", "--file", str(path)], workdir)
        except RuntimeError as e:
            # The old site 404s this image too; carrying the row across is
            # still right, so it is reported rather than fatal.
            return f"{item['id']}: not readable in the old bucket ({str(e).splitlines()[-1][:160]})"
        put(item, path)
        path.unlink()
        return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        up = list(pool.map(upload, plan["upload"]))
        cp = list(pool.map(copy, enumerate(plan["copy"])))
    missing = [m for m in up + cp if m]
    print(f"Uploaded {len(plan['upload'])} images from the database and copied "
          f"{len(plan['copy']) - len(missing)} of {len(plan['copy'])} from the old bucket.")
    for m in missing:
        print(f"  ! {m}")


def run_batch(sql, workdir):
    """Run one batch on the new database; None, or D1's error with the data scrubbed."""
    try:
        wrangler("new", ["d1", "execute", DB_NAME, "--json", "--command", sql], workdir, attempts=3, wait=5)
        return None
    except RuntimeError as e:
        return scrub(str(e))


def import_new(workdir):
    """Load the batches through D1's query API.

    Not `wrangler d1 execute --file`: that goes through D1's bulk-import
    service, which rejected this data twice with nothing more than
    {"D1_RESET_DO":true} while the same SQL ran cleanly in SQLite. The query
    API is the path the shop itself uses, and it names what it refuses. A
    batch is a transaction, so a failed one leaves nothing behind; it is then
    halved until the single statement at fault is found and named.
    """
    batches = json.loads((workdir / "batches.json").read_text())

    def attempt(batch, label):
        err = run_batch(as_sql(batch), workdir)
        if err is None:
            return
        if len(batch) == 1:
            sys.exit(f"{label}: {describe(batch[0])} is refused by D1:\n{err[-1500:]}\n\n"
                     "The batches before it are in the new database, so run again with "
                     "'Replace what is in the new database' ticked once this is fixed.")
        mid = len(batch) // 2
        attempt(batch[:mid], label)
        attempt(batch[mid:], label)

    for n, batch in enumerate(batches, 1):
        attempt(batch, f"Batch {n} of {len(batches)}")
    print(f"Loaded {sum(len(b) for b in batches)} statements in {len(batches)} batches.")


def verify(workdir):
    want = json.loads((workdir / "counts.json").read_text())
    got_tables = set(user_tables(query_new(TABLES_SQL, workdir)))
    present = [t for t in want if t in got_tables]
    counts = query_new_each([f'SELECT COUNT(*) AS n FROM "{t}"' for t in present], workdir)
    got = {t: r[0]["n"] for t, r in zip(present, counts)}
    bad = []
    for t, n in want.items():
        g = got.get(t)
        if g != n:
            bad.append(f"  {t}: expected {n}, new database has {'no table' if g is None else g}")
    extra = got_tables - set(want)
    if extra:
        bad.append(f"  unexpected tables in the new database: {sorted(extra)}")
    if bad:
        sys.exit("Row counts differ:\n" + "\n".join(bad))
    print(f"Verified: all {len(want)} tables match, {sum(want.values())} rows.")


def main(argv):
    if not argv:
        sys.exit(__doc__)
    cmd, rest = argv[0], argv[1:]
    if cmd == "check-target":
        replace = "--replace" in rest
        dirs = [a for a in rest if not a.startswith("--")]
        check_target(replace, Path(dirs[0] if dirs else "."))
    elif cmd == "prepare":
        prepare(rest[0], Path(rest[1]))
    elif cmd == "import":
        import_new(Path(rest[0]))
    elif cmd == "copy-media":
        copy_media(Path(rest[0]))
    elif cmd == "verify":
        verify(Path(rest[0]))
    else:
        sys.exit(f"unknown step {cmd!r}\n\n{__doc__}")


if __name__ == "__main__":
    main(sys.argv[1:])
