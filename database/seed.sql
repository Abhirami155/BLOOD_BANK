-- Sample Data for Blood Bank Management System
-- All passwords are 'bloodbank2026'

USE blood_bank_db;

-- 1. Insert Users (Admin, Hospital, Doctor, Donor, Patient)
INSERT INTO users (email, password, role) VALUES 
('admin@bloodbank.com', '$2b$10$bdabbmT7Vs7/BIthZxgt9uaaDlYXXcXCC7zV4bAfvnNg6lmKqfmXu', 'admin'),
('cityhospital@health.com', '$2b$10$bdabbmT7Vs7/BIthZxgt9uaaDlYXXcXCC7zV4bAfvnNg6lmKqfmXu', 'hospital'),
('lifeline@clinic.com', '$2b$10$bdabbmT7Vs7/BIthZxgt9uaaDlYXXcXCC7zV4bAfvnNg6lmKqfmXu', 'hospital'),
('drsmith@doctor.com', '$2b$10$bdabbmT7Vs7/BIthZxgt9uaaDlYXXcXCC7zV4bAfvnNg6lmKqfmXu', 'doctor'),
('johndoe@donor.com', '$2b$10$bdabbmT7Vs7/BIthZxgt9uaaDlYXXcXCC7zV4bAfvnNg6lmKqfmXu', 'donor'),
('janedoe@patient.com', '$2b$10$bdabbmT7Vs7/BIthZxgt9uaaDlYXXcXCC7zV4bAfvnNg6lmKqfmXu', 'patient');

-- 2. Insert Hospital Details
INSERT INTO hospitals (user_id, name, address, city, contact) VALUES 
(2, 'City General Hospital', '123 Medical Ave', 'New York', '123-456-7890'),
(3, 'Lifeline Clinic', '456 Wellness Blvd', 'Boston', '987-654-3210');

-- 3. Insert Doctor Details
INSERT INTO doctors (user_id, hospital_id, name, specialization, contact) VALUES 
(4, 1, 'Dr. Smith', 'Hematologist', '555-0101');

-- 4. Insert Donor Details
INSERT INTO donors (user_id, name, blood_group, dob, address, contact, age, registration_status) VALUES 
(5, 'John Doe', 'O+', '1990-05-15', '789 Donor Lane', '555-0202', 35, 'approved');

-- 5. Insert Patient Details
INSERT INTO patients (hospital_id, name, age, gender, blood_group, contact) VALUES 
(1, 'Jane Doe', 45, 'Female', 'A+', '555-0303');

-- 6. Initial Inventory
INSERT INTO blood_inventory (hospital_id, blood_group, quantity) VALUES 
(1, 'A+', 10),
(1, 'O+', 15),
(1, 'B-', 5),
(2, 'A+', 8),
(2, 'AB+', 3);

-- 7. Sample Requests (including some "old" ones for testing cleanup procedure)
INSERT INTO requests (requester_id, patient_id, doctor_id, hospital_id, blood_group, quantity, urgency, status, created_at) VALUES 
(4, 1, 1, 1, 'A+', 2, 'emergency', 'pending', CURDATE()),
(4, 1, 1, 1, 'O+', 1, 'normal', 'pending', DATE_SUB(CURDATE(), INTERVAL 10 DAY)); -- This one should be cleaned up!

-- 8. Sample Donation (marked completed to test triggers)
INSERT INTO donations (donor_id, hospital_id, blood_group, quantity, donation_date, status) VALUES 
(1, 1, 'O+', 1, CURDATE(), 'pending');
UPDATE donations SET status = 'completed' WHERE id = 1;

-- 9. More donations to test Donor Impact View
INSERT INTO donations (donor_id, hospital_id, blood_group, quantity, donation_date, status) VALUES 
(1, 1, 'O+', 1, DATE_SUB(CURDATE(), INTERVAL 4 MONTH), 'completed');

