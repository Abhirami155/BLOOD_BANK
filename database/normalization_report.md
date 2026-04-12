# Normalization Report - Blood Bank Management System

This document analyzes the normalization state of the database schema, ensuring data integrity and reducing redundancy.

## 1. First Normal Form (1NF)
**Requirement**: Atomic values, unique column names, and no repeating groups.
- **Analysis**: All tables in `schema.sql` (e.g., `users`, `donors`, `hospitals`) contain atomic attributes. For instance, the `blood_group` is a single ENUM value, not a list.
- **Status**: ✅ Satisfied.

## 2. Second Normal Form (2NF)
**Requirement**: Must be in 1NF and all non-key attributes must be fully functionally dependent on the Primary Key (no partial dependencies).
- **Analysis**:
    - Most tables use a single-column surrogate Primary Key (`id`).
    - In `blood_inventory`, the composite logical key is `(hospital_id, blood_group)`. The `quantity` and `last_updated` depend on the *entire* key.
- **Status**: ✅ Satisfied.

## 3. Third Normal Form (3NF)
**Requirement**: Must be in 2NF and no transitive dependencies (no non-key attribute depends on another non-key attribute).
- **Analysis**:
    - In `hospitals`, `city` and `contact` depend directly on the hospital `id`.
    - In `donors`, `blood_group` and `dob` depend on the donor `id`.
    - Note: If we stored `hospital_city` and `city_zip_code` in the same table, that would be a transitive dependency. We keep locations simple to stay in 3NF.
- **Status**: ✅ Satisfied.

## 4. Fourth Normal Form (4NF)
**Requirement**: Must be in 3NF and have no multi-valued dependencies (MVD). An MVD occurs when one attribute implies a set of other attributes independently.
- **Analysis**: 
    - The `doctors` table relates a doctor to exactly one hospital and one set of attributes.
    - If a doctor worked at multiple hospitals *and* had multiple independent specializations, we would need to split them into `DoctorHospitals` and `DoctorSpecializations`. Since they are 1:1 or 1:N in our current logic, there are no independent multi-valued facts.
- **Status**: ✅ Satisfied.

## 5. Fifth Normal Form (5NF / PJNF)
**Requirement**: Must be in 4NF and have no join dependencies that are not implied by candidate keys.
- **Analysis**:
    - This schema is designed such that information cannot be decomposed into smaller tables and then rejoined to create "spurious tuples."
    - All relationships (Donations, Requests) are centered around unique IDs that join back cleanly.
- **Status**: ✅ Satisfied.

## Summary of Functional Dependencies
- `users`: `id` -> `email`, `role`, `password`
- `donors`: `id` -> `name`, `blood_group`, `dob`, `user_id`
- `blood_inventory`: `(hospital_id, blood_group)` -> `quantity`
