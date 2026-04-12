# Database Concurrency & Recovery Mechanisms

This document outlines the techniques used in the project to manage concurrent data access and ensure system reliability during failures.

## 1. Concurrency Control Mechanisms
This application uses **MySQL (InnoDB Engine)**, which employs **Multi-Version Concurrency Control (MVCC)**.

### a. Transactions (ACID)
We use `pool.getConnection()` and `connection.beginTransaction()` in `authController.js` for registration. This ensures that:
- **Atomicity**: Either both the User and Donor records are created, or none are.
- **Consistency**: The database remains valid after every transaction.
- **Isolation**: Concurrent users don't see inconsistent registration states.
- **Durability**: Once committed, registrations are safe from crashes.

### b. Isolation Levels
By default, we use `REPEATABLE READ`. This prevents:
- **Dirty Reads**: A transaction reading uncommitted data.
- **Non-Repeatable Reads**: Data changing between two reads in the same transaction.

### c. Locking Logic
- **Row-Level Locking**: InnoDB locks only the specific rows being updated (e.g., updating a specific donor's `last_donation_date`).
- **Gap Locking**: Used in the `blood_inventory` table to prevent phantom reads when checking stock before an update.

---

## 2. Recovery Mechanisms
The system protects against data loss through robust logging and automated recovery.

### a. Redo Logs (Write-Ahead Logging)
When a donation is recorded, the changes are first written to the **Redo Log** on disk before being applied to data pages in memory. If a crash occurs, MySQL re-plays these logs to restore the database to its last consistent state.

### b. Undo Logs
Undo logs store the original version of a record before it is modified. If a registration fails (e.g., invalid email), the `connection.rollback()` command uses these logs to undo all changes made during the current transaction.

### c. Binary Logging (Point-in-Time Recovery)
The database can be configured with **Binary Logs** to record all changes. This allows for:
- Standard point-in-time recovery.
- Replication to secondary donor databases for high availability.

---

## 3. Potential Pitfalls & Solutions
- **Deadlocks**: Occur if two transactions wait for each other's locks (e.g., Hospital A and Hospital B updating each other's inventory).
- **Solution**: The application is designed to access tables in a consistent order, and InnoDB's deadlock detector automatically rolls back the "cheapest" transaction to resolve the conflict.
