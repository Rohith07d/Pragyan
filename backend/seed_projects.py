"""
AegisMeet Database Seeder: Project-Based Task & Meeting Isolation
==================================================================
Initializes exactly two projects:
1. Project A (Main): All users are members.
2. Project B (Confidential): Exactly 3 specific users (Admin, Rohith, Mayank) are members.
Enforces ProjectMembers junction table, mandatory project_id on Meetings and Tasks.
"""

import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.getenv("DATABASE_PATH", "tasks.db"))

def seed_database():
    print(f"Connecting to database at {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Projects table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    """)

    # 2. ProjectMembers junction table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ProjectMembers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL REFERENCES Projects(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, user_id)
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_project_members_project ON ProjectMembers(project_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_project_members_user ON ProjectMembers(user_id)")

    # 3. Add project_id to Meetings if missing
    cursor.execute("PRAGMA table_info(Meetings)")
    meet_cols = [row[1] for row in cursor.fetchall()]
    if "project_id" not in meet_cols:
        cursor.execute("ALTER TABLE Meetings ADD COLUMN project_id INTEGER REFERENCES Projects(id) ON DELETE CASCADE")
        print("Added 'project_id' column to Meetings table.")

    # 4. Add project_id to Tasks if missing
    cursor.execute("PRAGMA table_info(Tasks)")
    task_cols = [row[1] for row in cursor.fetchall()]
    if "project_id" not in task_cols:
        cursor.execute("ALTER TABLE Tasks ADD COLUMN project_id INTEGER REFERENCES Projects(id) ON DELETE CASCADE")
        print("Added 'project_id' column to Tasks table.")

    # 5. Initialize exactly two projects:
    # Project A (Main) and Project B (Confidential)
    cursor.execute("SELECT id FROM Projects WHERE name = 'Project A (Main)'")
    row_a = cursor.fetchone()
    if not row_a:
        cursor.execute("SELECT id FROM Projects WHERE id = 1")
        if cursor.fetchone():
            cursor.execute("UPDATE Projects SET name = 'Project A (Main)' WHERE id = 1")
            proj_a_id = 1
        else:
            cursor.execute("INSERT INTO Projects (name) VALUES ('Project A (Main)')")
            proj_a_id = cursor.lastrowid
    else:
        proj_a_id = row_a[0]

    cursor.execute("SELECT id FROM Projects WHERE name = 'Project B (Confidential)'")
    row_b = cursor.fetchone()
    if not row_b:
        cursor.execute("SELECT id FROM Projects WHERE id = 2")
        if cursor.fetchone():
            cursor.execute("UPDATE Projects SET name = 'Project B (Confidential)' WHERE id = 2")
            proj_b_id = 2
        else:
            cursor.execute("INSERT INTO Projects (name) VALUES ('Project B (Confidential)')")
            proj_b_id = cursor.lastrowid
    else:
        proj_b_id = row_b[0]

    # Clean up any extraneous projects
    cursor.execute("DELETE FROM Projects WHERE id NOT IN (?, ?)", (proj_a_id, proj_b_id))
    print(f"Projects initialized: Project A (ID: {proj_a_id}), Project B (ID: {proj_b_id})")

    # 6. Assign memberships
    # Project A (Main): ALL users
    cursor.execute("SELECT id, canonical_name FROM Users")
    all_users = cursor.fetchall()
    user_map = {row[1]: row[0] for row in all_users}

    for u_id, u_name in all_users:
        cursor.execute(
            "INSERT OR IGNORE INTO ProjectMembers (project_id, user_id) VALUES (?, ?)",
            (proj_a_id, u_id)
        )
    print(f"Assigned ALL {len(all_users)} users to Project A (Main).")

    # Project B (Confidential): Exactly 3 specific users (Admin, Rohith, Mayank)
    confidential_users = ["Admin", "Rohith", "Mayank"]
    cursor.execute("DELETE FROM ProjectMembers WHERE project_id = ?", (proj_b_id,))
    assigned_conf = []
    for uname in confidential_users:
        uid = user_map.get(uname)
        if uid:
            cursor.execute(
                "INSERT INTO ProjectMembers (project_id, user_id) VALUES (?, ?)",
                (proj_b_id, uid)
            )
            assigned_conf.append(uname)
    print(f"Assigned exactly 3 users {assigned_conf} to Project B (Confidential).")

    # 7. Update legacy Meetings & Tasks to default project
    cursor.execute(
        "UPDATE Meetings SET project_id = ? WHERE project_id IS NULL OR project_id NOT IN (?, ?)",
        (proj_a_id, proj_a_id, proj_b_id)
    )
    cursor.execute(
        "UPDATE Tasks SET project_id = ? WHERE project_id IS NULL OR project_id NOT IN (?, ?)",
        (proj_a_id, proj_a_id, proj_b_id)
    )

    # 8. Pre-seed distinct confidential tasks in Project B
    cursor.execute("SELECT COUNT(*) FROM Tasks WHERE project_id = ?", (proj_b_id,))
    if cursor.fetchone()[0] == 0:
        admin_id = user_map.get("Admin", 1)
        rohith_id = user_map.get("Rohith", 2)
        mayank_id = user_map.get("Mayank", 3)
        sample_confidential = [
            (1, proj_b_id, rohith_id, "Review air-gap cryptographic key rotation protocol", "Tomorrow at 4:00 PM", "pending"),
            (1, proj_b_id, mayank_id, "Conduct zero-leak penetration test on Featherless AI endpoint", "Friday", "pending"),
            (1, proj_b_id, admin_id, "Executive audit of classified project deliverables and RAM wiping", "unknown", "completed"),
        ]
        cursor.executemany(
            "INSERT INTO Tasks (meeting_id, project_id, assignee_id, task, deadline, status) VALUES (?, ?, ?, ?, ?, ?)",
            sample_confidential
        )
        print(f"Seeded {len(sample_confidential)} confidential tasks in Project B.")

    conn.commit()
    conn.close()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed_database()
