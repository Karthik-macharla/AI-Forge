"""
Demo database seeder for NL2SQL (Project 8).

Creates demo.db (SQLite) with four tables and ~50 realistic rows each:
  - departments
  - employees
  - projects
  - project_assignments

Run from the backend/ directory:
    python seed_demo_db.py

The demo.db will be created (or fully rebuilt) in the current directory.
Set NL2SQL_DATABASE_URL=sqlite:///./demo.db in backend/.env to use it.
"""
import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "demo.db"

# ── Schema ─────────────────────────────────────────────────────────────────

DDL = """
CREATE TABLE IF NOT EXISTS departments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    budget      REAL    NOT NULL,
    location    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    department  TEXT    NOT NULL REFERENCES departments(name),
    salary      REAL    NOT NULL,
    hire_date   TEXT    NOT NULL,
    manager_id  INTEGER REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS projects (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    start_date    TEXT    NOT NULL,
    end_date      TEXT,
    status        TEXT    NOT NULL CHECK(status IN ('active','completed','on_hold'))
);

CREATE TABLE IF NOT EXISTS project_assignments (
    employee_id   INTEGER NOT NULL REFERENCES employees(id),
    project_id    INTEGER NOT NULL REFERENCES projects(id),
    role          TEXT    NOT NULL,
    hours_per_week REAL   NOT NULL,
    PRIMARY KEY (employee_id, project_id)
);
"""

# ── Seed data ──────────────────────────────────────────────────────────────

DEPARTMENTS = [
    ("Engineering",    4_500_000.00, "Hyderabad"),
    ("Product",        1_800_000.00, "Bangalore"),
    ("Design",           900_000.00, "Mumbai"),
    ("Marketing",      1_200_000.00, "Delhi"),
    ("Sales",          2_000_000.00, "Chennai"),
    ("HR",               750_000.00, "Hyderabad"),
    ("Finance",          950_000.00, "Pune"),
    ("Data Science",   2_200_000.00, "Bangalore"),
]

FIRST_NAMES = [
    "Aarav", "Aditya", "Arjun", "Divya", "Ishaan", "Karthik", "Lakshmi",
    "Meera", "Neel", "Priya", "Rahul", "Riya", "Rohan", "Sanya", "Siddharth",
    "Tanvi", "Uday", "Vikram", "Zara", "Ananya", "Bhavna", "Chirag", "Deepika",
    "Esha", "Farhan", "Gaurav", "Hina", "Isha", "Jay", "Kavya",
]

LAST_NAMES = [
    "Sharma", "Verma", "Singh", "Nair", "Iyer", "Gupta", "Joshi", "Patel",
    "Kumar", "Reddy", "Mehta", "Bose", "Das", "Shah", "Trivedi",
]

PROJECT_NAMES = [
    "Project Atlas", "Project Orion", "Project Helix", "Project Nova",
    "Project Apex", "Project Zenith", "Project Aurora", "Project Horizon",
    "Project Catalyst", "Project Momentum", "Project Fusion", "Project Vertex",
    "Project Nexus", "Project Quantum", "Project Stellar",
]

ROLES = ["Lead", "Developer", "Analyst", "Designer", "QA Engineer", "Architect", "Coordinator"]
STATUSES = ["active", "completed", "on_hold"]


def random_date(start: date, end: date) -> str:
    delta = (end - start).days
    return (start + timedelta(days=random.randint(0, delta))).isoformat()


def seed(conn: sqlite3.Connection) -> None:
    random.seed(42)
    cur = conn.cursor()

    # Departments
    cur.executemany(
        "INSERT INTO departments (name, budget, location) VALUES (?, ?, ?)",
        DEPARTMENTS,
    )

    # Employees — first pass: managers (one per dept, id 1-8)
    managers: list[int] = []
    for dept_name, _, _ in DEPARTMENTS:
        fn = random.choice(FIRST_NAMES)
        ln = random.choice(LAST_NAMES)
        salary = round(random.uniform(120_000, 180_000), 2)
        hire = random_date(date(2015, 1, 1), date(2019, 12, 31))
        cur.execute(
            "INSERT INTO employees (name, department, salary, hire_date) VALUES (?, ?, ?, ?)",
            (f"{fn} {ln}", dept_name, salary, hire),
        )
        managers.append(cur.lastrowid)

    # Employees — remaining ~44 IC employees
    dept_names = [d[0] for d in DEPARTMENTS]
    for _ in range(44):
        dept = random.choice(dept_names)
        manager_id = managers[dept_names.index(dept)]
        fn = random.choice(FIRST_NAMES)
        ln = random.choice(LAST_NAMES)
        salary = round(random.uniform(55_000, 115_000), 2)
        hire = random_date(date(2018, 1, 1), date(2024, 12, 31))
        cur.execute(
            "INSERT INTO employees (name, department, salary, hire_date, manager_id) VALUES (?, ?, ?, ?, ?)",
            (f"{fn} {ln}", dept, salary, hire, manager_id),
        )

    # Fetch all employee & department IDs
    all_emp_ids = [r[0] for r in cur.execute("SELECT id FROM employees").fetchall()]
    dept_ids = [r[0] for r in cur.execute("SELECT id FROM departments").fetchall()]

    # Projects — 15 projects spread across departments
    for i, pname in enumerate(PROJECT_NAMES):
        dept_id = dept_ids[i % len(dept_ids)]
        start = random_date(date(2022, 1, 1), date(2024, 6, 1))
        start_d = date.fromisoformat(start)
        status = random.choice(STATUSES)
        if status == "completed":
            end = (start_d + timedelta(days=random.randint(60, 365))).isoformat()
        elif status == "on_hold":
            end = None
        else:
            end = None
        cur.execute(
            "INSERT INTO projects (name, department_id, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)",
            (pname, dept_id, start, end, status),
        )

    project_ids = [r[0] for r in cur.execute("SELECT id FROM projects").fetchall()]

    # Project assignments — ~3–6 employees per project, no duplicates
    seen: set[tuple[int, int]] = set()
    for proj_id in project_ids:
        assignees = random.sample(all_emp_ids, k=random.randint(3, 6))
        for emp_id in assignees:
            if (emp_id, proj_id) in seen:
                continue
            seen.add((emp_id, proj_id))
            cur.execute(
                "INSERT INTO project_assignments (employee_id, project_id, role, hours_per_week) VALUES (?, ?, ?, ?)",
                (emp_id, proj_id, random.choice(ROLES), round(random.uniform(10, 40), 1)),
            )

    conn.commit()
    print(f"✓ Seeded demo.db at {DB_PATH}")
    for table in ("departments", "employees", "projects", "project_assignments"):
        (count,) = cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()  # noqa: S608
        print(f"  {table}: {count} rows")


def main() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
        print(f"Removed existing {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(DDL)
        seed(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
