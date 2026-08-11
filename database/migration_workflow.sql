-- =========================================================
-- Blood Bank Workflow Enforcement Migration
-- Run this script once against blood_bank_db
-- =========================================================

USE blood_bank_db;

-- Add user_id to patients (allows patient login + session linking)
ALTER TABLE patients 
    ADD COLUMN user_id INT UNIQUE NULL AFTER id;

-- Add doctor_id to patients (links patient to their assigned doctor)
ALTER TABLE patients 
    ADD COLUMN doctor_id INT NULL AFTER hospital_id;

-- Foreign key: patient login account
ALTER TABLE patients 
    ADD CONSTRAINT fk_patients_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Foreign key: assigned doctor
ALTER TABLE patients 
    ADD CONSTRAINT fk_patients_doctor 
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL;
