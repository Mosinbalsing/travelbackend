-- Create User table
CREATE TABLE IF NOT EXISTS User (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    email VARCHAR(100),
    mobile VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create AvailableTaxis table
CREATE TABLE IF NOT EXISTS AvailableTaxis (
    TaxiID INT PRIMARY KEY AUTO_INCREMENT,
    PickupLocation VARCHAR(100),
    DropLocation VARCHAR(100),
    Sedan_Available INT DEFAULT 2,
    Sedan_Price DECIMAL(10,2),
    Hatchback_Available INT DEFAULT 4,
    Hatchback_Price DECIMAL(10,2),
    SUV_Available INT DEFAULT 1,
    SUV_Price DECIMAL(10,2),
    Prime_SUV_Available INT DEFAULT 1,
    Prime_SUV_Price DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create BookingTaxis table
CREATE TABLE IF NOT EXISTS BookingTaxis (
    booking_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_date DATETIME,
    travel_date DATE,
    vehicle_type VARCHAR(50),
    number_of_passengers INT,
    pickup_location VARCHAR(100),
    drop_location VARCHAR(100),
    user_id INT,
    status VARCHAR(20) DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id)
);

-- Create TaxiAvailabilityByDate table
CREATE TABLE IF NOT EXISTS TaxiAvailabilityByDate (
    id INT PRIMARY KEY AUTO_INCREMENT,
    travel_date DATE,
    vehicle_type VARCHAR(50),
    pickup_location VARCHAR(100),
    drop_location VARCHAR(100),
    available_count INT,
    restoration_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create PastBookings table
CREATE TABLE IF NOT EXISTS PastBookings (
    booking_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_date DATETIME,
    travel_date DATE,
    vehicle_type VARCHAR(50),
    number_of_passengers INT,
    pickup_location VARCHAR(100),
    drop_location VARCHAR(100),
    user_id INT,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id)
);

-- Insert initial data into AvailableTaxis
INSERT INTO AvailableTaxis (PickupLocation, DropLocation, Sedan_Available, Sedan_Price, Hatchback_Available, Hatchback_Price, SUV_Available, SUV_Price, Prime_SUV_Available, Prime_SUV_Price)
VALUES 
('Pune', 'Shirdi', 2, 1500.00, 4, 1200.00, 1, 2000.00, 1, 2500.00),
('Shirdi', 'Pune', 2, 1500.00, 4, 1200.00, 1, 2000.00, 1, 2500.00),
('Pune', 'Lonavla', 2, 800.00, 4, 600.00, 1, 1200.00, 1, 1500.00),
('Lonavla', 'Pune', 2, 800.00, 4, 600.00, 1, 1200.00, 1, 1500.00)
ON DUPLICATE KEY UPDATE
Sedan_Available = VALUES(Sedan_Available),
Sedan_Price = VALUES(Sedan_Price),
Hatchback_Available = VALUES(Hatchback_Available),
Hatchback_Price = VALUES(Hatchback_Price),
SUV_Available = VALUES(SUV_Available),
SUV_Price = VALUES(SUV_Price),
Prime_SUV_Available = VALUES(Prime_SUV_Available),
Prime_SUV_Price = VALUES(Prime_SUV_Price); 