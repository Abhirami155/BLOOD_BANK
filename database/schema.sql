-- Blood Bank Management System Schema

CREATE DATABASE IF NOT EXISTS blood_bank_db;
USE blood_bank_db;

-- 0. Audit Logs Table (For tracking changes)
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1. Users Table (Core for Authentication & RBAC)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'hospital', 'doctor', 'donor', 'patient') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Hospitals Table
CREATE TABLE hospitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_hospital_contact CHECK (LENGTH(contact) >= 7)
);

-- 3. Doctors Table
CREATE TABLE doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    hospital_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    specialization VARCHAR(100),
    contact VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
    CONSTRAINT chk_doctor_contact CHECK (LENGTH(contact) >= 7)
);

-- 4. Donors Table
CREATE TABLE donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    dob DATE NOT NULL,
    address TEXT,
    contact VARCHAR(20) NOT NULL,
    age INT NOT NULL,
    last_donation_date DATE DEFAULT NULL,
    registration_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_donor_age CHECK (age >= 18)
);

-- 5. Patients Table
CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    age INT NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    contact VARCHAR(20),
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
    CONSTRAINT chk_patient_age CHECK (age >= 0 AND age <= 120)
);

-- 6. Blood Inventory Table
CREATE TABLE blood_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    quantity INT DEFAULT 0 COMMENT 'In units/ml',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
    CONSTRAINT chk_inventory_qty CHECK (quantity >= 0),
    UNIQUE KEY (hospital_id, blood_group)
);

-- 7. Blood Requests Table
CREATE TABLE requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requester_id INT NOT NULL COMMENT 'ID of the user (Patient/Doctor/Hospital) who raised it',
    patient_id INT DEFAULT NULL,
    doctor_id INT DEFAULT NULL,
    hospital_id INT NOT NULL COMMENT 'Target hospital',
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    quantity INT NOT NULL,
    urgency ENUM('normal', 'emergency') DEFAULT 'normal',
    status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
    CONSTRAINT chk_request_qty CHECK (quantity > 0)
);

-- 8. Donations Table
CREATE TABLE donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id INT NOT NULL,
    hospital_id INT NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    quantity INT NOT NULL,
    donation_date DATE NOT NULL,
    status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
    FOREIGN KEY (donor_id) REFERENCES donors(id),
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
    CONSTRAINT chk_donation_qty CHECK (quantity > 0)
);

-- VIEWS --
CREATE VIEW view_hospital_inventory_summary AS SELECT h.name AS hospital_name, bi.blood_group, bi.quantity, bi.last_updated FROM blood_inventory bi JOIN hospitals h ON bi.hospital_id = h.id;

CREATE VIEW view_donor_impact_report AS SELECT d.id AS donor_id, d.name, d.blood_group, COUNT(dn.id) AS total_donations, SUM(IFNULL(dn.quantity, 0)) AS total_quantity_donated FROM donors d LEFT JOIN donations dn ON d.id = dn.donor_id AND dn.status = 'completed' GROUP BY d.id;

-- TRIGGERS --

DELIMITER //

CREATE TRIGGER after_user_insert AFTER INSERT ON users FOR EACH ROW BEGIN INSERT INTO audit_logs (action_type, table_name, record_id, details) VALUES ('INSERT', 'users', NEW.id, CONCAT('New user registered with role: ', NEW.role)); END //

CREATE TRIGGER after_donation_update AFTER UPDATE ON donations FOR EACH ROW BEGIN IF NEW.status = 'completed' AND OLD.status != 'completed' THEN UPDATE donors SET last_donation_date = NEW.donation_date WHERE id = NEW.donor_id; INSERT INTO blood_inventory (hospital_id, blood_group, quantity) VALUES (NEW.hospital_id, NEW.blood_group, NEW.quantity) ON DUPLICATE KEY UPDATE quantity = quantity + NEW.quantity; END IF; END //

CREATE TRIGGER after_request_update AFTER UPDATE ON requests FOR EACH ROW BEGIN IF NEW.status = 'completed' AND OLD.status != 'completed' THEN UPDATE blood_inventory SET quantity = quantity - NEW.quantity WHERE hospital_id = NEW.hospital_id AND blood_group = NEW.blood_group; END IF; END //

DELIMITER ;

-- FUNCTIONS & PROCEDURES --

DELIMITER //

CREATE FUNCTION fn_calculate_age(p_dob DATE) RETURNS INT DETERMINISTIC BEGIN RETURN FLOOR(DATEDIFF(CURDATE(), p_dob) / 365.25); END //


CREATE FUNCTION fn_is_eligible_to_donate(p_donor_id INT) RETURNS BOOLEAN DETERMINISTIC BEGIN DECLARE v_last_date DATE; SELECT last_donation_date INTO v_last_date FROM donors WHERE id = p_donor_id; IF v_last_date IS NULL OR DATEDIFF(CURDATE(), v_last_date) >= 90 THEN RETURN TRUE; ELSE RETURN FALSE; END IF; END //

CREATE PROCEDURE sp_cleanup_expired_requests() BEGIN DECLARE v_finished INTEGER DEFAULT 0; DECLARE v_request_id INTEGER; DECLARE req_cursor CURSOR FOR SELECT id FROM requests WHERE status = 'pending' AND DATEDIFF(CURDATE(), created_at) > 7; DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_finished = 1; DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN INSERT INTO audit_logs (action_type, table_name, record_id, details) VALUES ('PROC_ERROR', 'requests', 0, 'Error during cleanup'); RESIGNAL; END; OPEN req_cursor; get_req: LOOP FETCH req_cursor INTO v_request_id; IF v_finished = 1 THEN LEAVE get_req; END IF; UPDATE requests SET status = 'rejected' WHERE id = v_request_id; INSERT INTO audit_logs (action_type, table_name, record_id, details) VALUES ('CLEANUP', 'requests', v_request_id, 'Auto rejected'); END LOOP get_req; CLOSE req_cursor; END //

CREATE PROCEDURE sp_create_blood_request( IN p_requester_id INT, IN p_patient_id INT, IN p_doctor_id INT, IN p_hospital_id INT, IN p_blood_group VARCHAR(5), IN p_quantity INT, IN p_urgency VARCHAR(20) ) BEGIN DECLARE v_stock INT; SELECT IFNULL(SUM(quantity), 0) INTO v_stock FROM blood_inventory WHERE hospital_id = p_hospital_id AND blood_group = p_blood_group; IF v_stock >= p_quantity THEN INSERT INTO requests (requester_id, patient_id, doctor_id, hospital_id, blood_group, quantity, urgency, status) VALUES (p_requester_id, p_patient_id, p_doctor_id, p_hospital_id, p_blood_group, p_quantity, p_urgency, 'pending'); ELSE INSERT INTO requests (requester_id, patient_id, doctor_id, hospital_id, blood_group, quantity, urgency, status) VALUES (p_requester_id, p_patient_id, p_doctor_id, p_hospital_id, p_blood_group, p_quantity, p_urgency, 'pending'); END IF; END //

DELIMITER ;

-- INDEXES --
CREATE INDEX idx_blood_group ON blood_inventory(blood_group);
CREATE INDEX idx_city ON hospitals(city);
CREATE INDEX idx_donor_blood ON donors(blood_group);


