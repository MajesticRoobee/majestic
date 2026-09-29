#!/usr/bin/env python3
"""Copy the shop from the old Cloudflare account into the new one.

Cloudflare cannot move a D1 database or an R2 bucket between accounts, so the
move is a copy: the database is exported from the old account, reshaped, and
imported into the new one, and every product image is re-uploaded to the new
bucket. `.github/workflows/migrate-account.yml` runs the steps in order:

  check-target [--replace]   refuse to import over data unless told to, and
                             when told to, empty the new database first
  prepare <export.sql> <dir> reshape the export (below), writing import.sql,
                             the images to upload, and the expected row counts
  copy-media <dir>           put every image into the new account's bucket
  verify <dir>               compare the new database's row counts with the
                             export's, table by table

**Why the export is reshaped rather than imported as-is.** 174 images still
live inside the old database as BLOBs (see worker/media.js); only the newer 48
are in R2. Rather than carry those BLOBs across, `prepare` lifts them out, and
`copy-media` puts them in the new bucket, so the new database arrives without
them and every image serves from R2 from day one. That is the same end state
the admin's "move images to R2" action produces, reached without touching the
old account. It also keeps each import statement small. It uses Python
because its sqlite3 module can load the export and write it back out
(`iterdump`) with exact quoting. Node has no equivalent built in.

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


def wrangler(side, args, cwd, attempts=3):
    """Run wrangler against one account; retry transient failures."""
    cmd = [WRANGLER, *args, *side_args(side)]
    for attempt in range(1, attempts + 1):
        r = subprocess.run(cmd, cwd=cwd, env=side_env(side), capture_output=True, text=True)
        if r.returncode == 0:
            return r.stdout
        if attempt == attempts:
            # --json failures land on stdout, the rest on stderr.
            raise RuntimeError(f"wrangler {args[0]} {args[1]} failed:\n{(r.stdout + r.stderr)[-2000:]}")
        time.sleep(2 * attempt)


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
    # One file, one transaction: if any DROP fails, nothing is dropped.
    drop = workdir / "reset.sql"
    drop.write_text(
        "PRAGMA defer_foreign_keys = TRUE;\n"
        + "".join(f'DROP TABLE IF EXISTS "{t}";\n' for t in order)
    )
    wrangler("new", ["d1", "execute", DB_NAME, "--yes", "--file", str(drop)], workdir)
    left = user_tables(query_new(TABLES_SQL, workdir))
    if left:
        sys.exit(f"Reset left tables behind: {left}")
    print(f"Emptied the new database ({len(tables)} tables dropped).")


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

    # iterdump opens and closes its own transaction; D1 runs an import as one
    # transaction itself and rejects BEGIN/COMMIT, and it takes foreign keys
    # through defer_foreign_keys rather than foreign_keys=OFF.
    #
    # iterdump also writes each table's rows straight after its CREATE, in
    # alphabetical order — so `stock` rows would arrive before the `variants`
    # table they reference exists, which SQLite refuses even with the checks
    # deferred ("no such table: main.variants"). So: every table first, then
    # every row, then indexes, triggers and views.
    tables, rows, rest = [], [], []
    for stmt in conn.iterdump():
        head = stmt.lstrip().upper()
        if head.startswith(("BEGIN", "COMMIT", "PRAGMA")):
            continue
        if head.startswith("CREATE TABLE"):
            tables.append(stmt)
        elif head.startswith(("INSERT", "DELETE")):
            rows.append(stmt)
        else:
            rest.append(stmt)
    lines = ["PRAGMA defer_foreign_keys = TRUE;", *tables, *rows, *rest]
    (workdir / "import.sql").write_text("\n".join(lines) + "\n")

    counts = {t: conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
              for t in user_tables(conn.execute(TABLES_SQL).fetchall())}
    (workdir / "counts.json").write_text(json.dumps(counts, indent=1))
    (workdir / "media.json").write_text(json.dumps({"copy": copy, "upload": upload}, indent=1))

    size = (workdir / "import.sql").stat().st_size
    print(f"Prepared {len(counts)} tables, {sum(counts.values())} rows, import file {size / 1e6:.1f} MB.")
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
    elif cmd == "copy-media":
        copy_media(Path(rest[0]))
    elif cmd == "verify":
        verify(Path(rest[0]))
    else:
        sys.exit(f"unknown step {cmd!r}\n\n{__doc__}")


if __name__ == "__main__":
    main(sys.argv[1:])
