const { pool } = require("../config/db");

const createBookingTable = async () => {
  try {
    console.log("Creating BookingTaxis table...");
    
    // First, check if table exists
    const [existingTables] = await pool.query('SHOW TABLES LIKE "BookingTaxis"');
    if (existingTables.length > 0) {
      console.log("BookingTaxis table already exists");
      return;
    }

    // Create BookingTaxis table
    await pool.query(`
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

    // Verify table was created
    const [tables] = await pool.query('SHOW TABLES LIKE "BookingTaxis"');
    if (tables.length === 0) {
      throw new Error("Failed to create BookingTaxis table");
    }

    // Set the initial booking_id to 1001 if the table is empty
    const [count] = await pool.query('SELECT COUNT(*) as count FROM BookingTaxis');
    if (count[0].count === 0) {
      await pool.query('ALTER TABLE BookingTaxis AUTO_INCREMENT = 1001');
    }

    // Create TaxiAvailabilityByDate table
    await pool.query(`
            CREATE TABLE IF NOT EXISTS TaxiAvailabilityByDate (
                id INT PRIMARY KEY AUTO_INCREMENT,
                travel_date DATE NOT NULL,
                vehicle_type VARCHAR(50) NOT NULL,
                pickup_location VARCHAR(100),
                drop_location VARCHAR(100),
                available_count INT DEFAULT 0,
                restoration_time DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY date_vehicle (travel_date, vehicle_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

    console.log("All tables created successfully");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  }
};

const createBooking = async (bookingData) => {
  try {
    console.log("Creating booking...", bookingData);
    
    await createBookingTable();
    
    const validVehicleTypes = ["Sedan", "Hatchback", "SUV", "Prime_SUV"];
    if (!validVehicleTypes.includes(bookingData.vehicleType)) {
      return {
        success: false,
        message: `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(", ")}`
      };
    }

    const travelDate = new Date(bookingData.travelDate);
    const today = new Date();
    
    if (travelDate.toDateString() === today.toDateString() && 
        (today.getHours() > 22 || (today.getHours() === 22 && today.getMinutes() > 0))) {
      return {
        success: false,
        message: "Cannot create bookings after 10 PM for today"
      };
    }

    const [user] = await pool.query(
      "SELECT user_id FROM User WHERE mobile = ?",
      [bookingData.userDetails.mobile]
    );
    if (!user?.length) return { success: false, message: "User not found" };

    const userId = user[0].user_id;
    const currentDateTime = new Date().toISOString().slice(0, 19).replace("T", " ");
    const checkColumn = `${bookingData.vehicleType}_Available`;

    await pool.query("START TRANSACTION");

    try {
      const [availability] = await pool.query(
        `SELECT a.*, 
                COALESCE(b.booked_count, 0) as booked_count
         FROM AvailableTaxis a
         LEFT JOIN (
           SELECT COUNT(*) as booked_count
           FROM BookingTaxis
           WHERE vehicle_type = ?
           AND travel_date = ?
           AND status = 'confirmed'
         ) b ON 1=1
         WHERE a.${checkColumn} > COALESCE(b.booked_count, 0)
         AND a.pickup_location = ?
         AND a.drop_location = ?`,
        [
          bookingData.vehicleType,
          bookingData.travelDate,
          bookingData.pickupLocation,
          bookingData.dropLocation
        ]
      );

      if (!availability.length) {
        await pool.query("ROLLBACK");
        return {
          success: false,
          message: `No ${bookingData.vehicleType} vehicles available for this route and date`
        };
      }

      const [result] = await pool.query(
        `INSERT INTO BookingTaxis (
          booking_date, travel_date, vehicle_type,
          number_of_passengers, pickup_location,
          drop_location, user_id, departure_time, price,status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
        [
          currentDateTime,
          bookingData.travelDate,
          bookingData.vehicleType,
          bookingData.numberOfPassengers || 1,
          bookingData.pickupLocation,
          bookingData.dropLocation,
          userId,
          bookingData.departureTime,
          bookingData.price
        ]
      );

      // Update TaxiAvailabilityByDate for all bookings
      const [existingAvailability] = await pool.query(
        `SELECT * FROM TaxiAvailabilityByDate 
         WHERE travel_date = ? AND vehicle_type = ?`,
        [bookingData.travelDate, bookingData.vehicleType]
      );

      // Set restoration time to midnight (12:00 AM) of the travel date
      const restorationTime = new Date(bookingData.travelDate);
      restorationTime.setHours(0, 0, 0, 0);

      if (existingAvailability.length > 0) {
        // Update existing entry
        await pool.query(
          `UPDATE TaxiAvailabilityByDate 
           SET available_count = available_count - 1,
               pickup_location = ?,
               drop_location = ?,
               restoration_time = ?
           WHERE travel_date = ? AND vehicle_type = ?`,
          [bookingData.pickupLocation, bookingData.dropLocation, restorationTime, bookingData.travelDate, bookingData.vehicleType]
        );
      } else {
        // Get total available count for this vehicle type
        let checkColumn;
        switch (bookingData.vehicleType) {
          case "Sedan": checkColumn = "Sedan_Available"; break;
          case "Hatchback": checkColumn = "Hatchback_Available"; break;
          case "SUV": checkColumn = "SUV_Available"; break;
          case "Prime_SUV": checkColumn = "Prime_SUV_Available"; break;
        }

        const [totalAvailable] = await pool.query(
          `SELECT ${checkColumn} as total_count FROM AvailableTaxis LIMIT 1`
        );

        // Create new entry with total available count minus 1
        await pool.query(
          `INSERT INTO TaxiAvailabilityByDate 
           (travel_date, vehicle_type, pickup_location, drop_location, available_count, restoration_time)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            bookingData.travelDate,
            bookingData.vehicleType,
            bookingData.pickupLocation,
            bookingData.dropLocation,
            totalAvailable[0].total_count - 1,
            restorationTime
          ]
        );
      }

      // For same-day bookings, also update AvailableTaxis table
      if (travelDate.toDateString() === today.toDateString()) {
        await pool.query(
          `UPDATE AvailableTaxis 
           SET ${checkColumn} = ${checkColumn} - 1
           WHERE pickup_location = ? AND drop_location = ?`,
          [bookingData.pickupLocation, bookingData.dropLocation]
        );
      }

      await pool.query("COMMIT");

      const delayMs = restorationTime.getTime() - new Date().getTime();

      if (delayMs > 0) {
        setTimeout(async () => {
          try {
            await pool.query(
              `UPDATE AvailableTaxis 
               SET ${checkColumn} = ${checkColumn} + 1
               WHERE pickup_location = ? AND drop_location = ?`,
              [bookingData.pickupLocation, bookingData.dropLocation]
            );

            await pool.query(
              `UPDATE BookingTaxis 
               SET status = 'completed'
               WHERE vehicle_type = ?
               AND travel_date = ?
               AND status = 'confirmed'`,
              [bookingData.vehicleType, bookingData.travelDate]
            );
          } catch (error) {
            console.error("Error in scheduled restoration:", error);
          }
        }, delayMs);
      }

      return {
        success: true,
        message: "Booking created successfully",
        data: {
          bookingId: result.insertId,
          bookingDate: currentDateTime,
          travelDate: bookingData.travelDate,
          vehicleType: bookingData.vehicleType,
          numberOfPassengers: bookingData.numberOfPassengers,
          pickupLocation: bookingData.pickupLocation,
          dropLocation: bookingData.dropLocation,
          userDetails: bookingData.userDetails
        }
      };
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Error creating booking:", error);
    return {
      success: false,
      message: "Failed to create booking",
      error: error.message
    };
  }
};

// Update restore availability function to work with dates
const restoreAvailability = async (vehicleType, travelDate, pickupLocation, dropLocation) => {
  try {
    // Validate vehicle type
    const validVehicleTypes = ["Sedan", "Hatchback", "SUV", "Prime_SUV"];
    if (!validVehicleTypes.includes(vehicleType)) {
      throw new Error(`Invalid vehicle type. Must be one of: ${validVehicleTypes.join(", ")}`);
    }

    const updateColumn = `${vehicleType}_Available`;

    // Start transaction for atomic operations
    await pool.query("START TRANSACTION");

    try {
      // 1. Update booking status
      await pool.query(
        `UPDATE BookingTaxis 
         SET status = 'completed'
         WHERE vehicle_type = ?
         AND travel_date = ?
         AND status = 'confirmed'`,
        [vehicleType, travelDate]
      );

      // 2. Restore availability count for specific route if locations are provided
      if (pickupLocation && dropLocation) {
        await pool.query(
          `UPDATE AvailableTaxis 
           SET ${updateColumn} = ${updateColumn} + 1
           WHERE pickup_location = ? 
           AND drop_location = ?`,
          [pickupLocation, dropLocation]
        );
      } else {
        // If no specific route provided, restore one availability globally
        await pool.query(
          `UPDATE AvailableTaxis 
           SET ${updateColumn} = ${updateColumn} + 1
           LIMIT 1`
        );
      }

      // 3. Update availability tracking
      await pool.query(
        `UPDATE TaxiAvailabilityByDate
         SET available_count = GREATEST(available_count - 1, 0),
             restoration_time = NULL
         WHERE vehicle_type = ?
         AND travel_date = ?`,
        [vehicleType, travelDate]
      );

      await pool.query("COMMIT");

      console.log(`Successfully restored availability for ${vehicleType} on ${travelDate}`);
      return {
        success: true,
        message: `Availability restored for ${vehicleType}`,
        vehicleType,
        travelDate
      };
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Error restoring availability:", error);
    return {
      success: false,
      message: "Failed to restore availability",
      error: error.message,
      vehicleType,
      travelDate
    };
  }
};

// Update the getCurrentAvailability function to check specific date
const getCurrentAvailability = async (vehicleType, travelDate) => {
  try {
    let checkColumn;
    switch (vehicleType) {
      case "Sedan":
        checkColumn = "Sedan_Available";
        break;
      case "Hatchback":
        checkColumn = "Hatchback_Available";
        break;
      case "SUV":
        checkColumn = "SUV_Available";
        break;
      case "Prime_SUV":
        checkColumn = "Prime_SUV_Available";
        break;
      default:
        throw new Error("Invalid vehicle type");
    }

    const [result] = await pool.query(
      `SELECT a.${checkColumn} - COALESCE(b.booked_count, 0) as available
             FROM AvailableTaxis a
             LEFT JOIN (
                 SELECT COUNT(*) as booked_count
                 FROM BookingTaxis
                 WHERE vehicle_type = ?
                 AND travel_date = ?
                 AND status = 'confirmed'
             ) b ON 1=1`,
      [vehicleType, travelDate]
    );

    return result[0]?.available || 0;
  } catch (error) {
    console.error("Error getting availability:", error);
    throw error;
  }
};

// Update the handle expired bookings function
const handleExpiredBookings = async () => {
  try {
    // Get expired bookings grouped by vehicle type
    const [expiredBookings] = await pool.query(`
            SELECT vehicle_type, travel_date, COUNT(*) as count
            FROM BookingTaxis 
            WHERE travel_date < CURDATE() 
            AND status = 'confirmed'
            GROUP BY vehicle_type, travel_date
        `);

    // Restore availability for each vehicle type and date
    for (const booking of expiredBookings) {
      let checkColumn;
      switch (booking.vehicle_type) {
        case "Sedan":
          checkColumn = "Sedan_Available";
          break;
        case "Hatchback":
          checkColumn = "Hatchback_Available";
          break;
        case "SUV":
          checkColumn = "SUV_Available";
          break;
        case "Prime_SUV":
          checkColumn = "Prime_SUV_Available";
          break;
      }

      // Restore availability for all routes but don't exceed original count
      await pool.query(
        `UPDATE AvailableTaxis 
         SET ${checkColumn} = LEAST(${checkColumn} + 1, (
             SELECT original_count 
             FROM (
                 SELECT ${checkColumn} as original_count 
                 FROM AvailableTaxis 
                 LIMIT 1
             ) as original
         ))
         WHERE ${checkColumn} < (
             SELECT original_count 
             FROM (
                 SELECT ${checkColumn} as original_count 
                 FROM AvailableTaxis 
                 LIMIT 1
             ) as original
         )`,
        []
      );

      // Update booking status
      await pool.query(
        `UPDATE BookingTaxis 
         SET status = 'completed'
         WHERE vehicle_type = ?
         AND travel_date = ?
         AND status = 'confirmed'`,
        [booking.vehicle_type, booking.travel_date]
      );

      console.log(`Restored availability for ${booking.vehicle_type} on ${booking.travel_date}`);
    }
  } catch (error) {
    console.error("Error handling expired bookings:", error);
  }
};

// Update the pending restorations handler
const handlePendingRestorations = async () => {
  try {
    // Check if table exists before querying
    const [tables] = await pool.query('SHOW TABLES LIKE "BookingTaxis"');
    if (tables.length === 0) {
      console.log("BookingTaxis table does not exist, skipping pending restorations");
      return;
    }

    const [pendingBookings] = await pool.query(`
            SELECT vehicle_type, travel_date
            FROM BookingTaxis
            WHERE status = 'confirmed'
            AND booking_date >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            GROUP BY vehicle_type, travel_date
        `);

    for (const booking of pendingBookings) {
      await restoreAvailability(booking.vehicle_type, booking.travel_date);
      console.log(
        `Restored availability for pending bookings of type ${booking.vehicle_type} for date ${booking.travel_date}`
      );
    }
  } catch (error) {
    console.error("Error handling pending restorations:", error);
  }
};

// Call this when your server starts
handlePendingRestorations();

// Update the processFutureBookings function to handle specific dates
const processFutureBookings = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all bookings for today that need to be processed
    const [todayBookings] = await pool.query(
      `SELECT * FROM BookingTaxis 
       WHERE travel_date = ? 
       AND status = 'confirmed'`,
      [today]
    );

    for (const booking of todayBookings) {
      let checkColumn;
      switch (booking.vehicle_type) {
        case "Sedan":
          checkColumn = "Sedan_Available";
          break;
        case "Hatchback":
          checkColumn = "Hatchback_Available";
          break;
        case "SUV":
          checkColumn = "SUV_Available";
          break;
        case "Prime_SUV":
          checkColumn = "Prime_SUV_Available";
          break;
      }

      // Decrement available taxis for all routes but ensure it doesn't go below 0
      await pool.query(
        `UPDATE AvailableTaxis 
         SET ${checkColumn} = GREATEST(${checkColumn} - 1, 0)
         WHERE ${checkColumn} > 0`,
        []
      );

      // Update TaxiAvailabilityByDate for the specific date only
      await pool.query(
        `INSERT INTO TaxiAvailabilityByDate 
         (travel_date, vehicle_type, available_count)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE 
         available_count = available_count + 1`,
        [today, booking.vehicle_type]
      );
    }
  } catch (error) {
    console.error("Error processing future bookings:", error);
  }
};

// Call processFutureBookings every hour
setInterval(processFutureBookings, 60 * 60 * 1000);

// Add new function to clear table data
const clearTableData = async () => {
  try {
    // Start a transaction
    await pool.query("START TRANSACTION");

    try {
      // Clear BookingTaxis table data
      await pool.query("TRUNCATE TABLE BookingTaxis");
      
      // Clear TaxiAvailabilityByDate table data
      await pool.query("TRUNCATE TABLE TaxiAvailabilityByDate");

      await pool.query("COMMIT");

      return {
        success: true,
        message: "All table data cleared successfully while preserving structure"
      };
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Error clearing table data:", error);
    return {
      success: false,
      message: "Failed to clear table data",
      error: error.message
    };
  }
};

// Update the checkVehicleAvailability function
const checkVehicleAvailability = async (vehicleType, travelDate) => {
  try {
    let checkColumn;
    switch (vehicleType) {
      case "Sedan":
        checkColumn = "Sedan_Available";
        break;
      case "Hatchback":
        checkColumn = "Hatchback_Available";
        break;
      case "SUV":
        checkColumn = "SUV_Available";
        break;
      case "Prime_SUV":
        checkColumn = "Prime_SUV_Available";
        break;
      default:
        throw new Error("Invalid vehicle type");
    }

    // First check TaxiAvailabilityByDate table
    const [dateAvailability] = await pool.query(
      `SELECT available_count, restoration_time
       FROM TaxiAvailabilityByDate
       WHERE vehicle_type = ? AND travel_date = ?`,
      [vehicleType, travelDate]
    );

    // Get total available count from AvailableTaxis
    const [totalAvailability] = await pool.query(
      `SELECT ${checkColumn} as total_count
       FROM AvailableTaxis
       LIMIT 1`
    );

    if (!totalAvailability || totalAvailability.length === 0) {
      return {
        available: false,
        message: "No vehicles available"
      };
    }

    const totalCount = totalAvailability[0].total_count;

    // Get booked count for this date
    const [bookedCount] = await pool.query(
      `SELECT COUNT(*) as booked_count
       FROM BookingTaxis
       WHERE vehicle_type = ?
       AND travel_date = ?
       AND status = 'confirmed'`,
      [vehicleType, travelDate]
    );

    const currentBookedCount = bookedCount[0].booked_count;

    // If there's a date-specific availability record
    if (dateAvailability && dateAvailability.length > 0) {
      const dateSpecificCount = dateAvailability[0].available_count;
      
      // If restoration time is set and in the future, vehicle is temporarily unavailable
      if (dateAvailability[0].restoration_time && 
          new Date(dateAvailability[0].restoration_time) > new Date()) {
        return {
          available: false,
          message: "Vehicle is temporarily unavailable",
          nextAvailable: dateAvailability[0].restoration_time
        };
      }

      // Use the date-specific count if it's more restrictive
      const effectiveAvailableCount = Math.min(totalCount - currentBookedCount, dateSpecificCount);
      
      if (effectiveAvailableCount <= 0) {
        return {
          available: false,
          message: `No ${vehicleType} vehicles available for ${travelDate}`
        };
      }

      return {
        available: true,
        message: `${effectiveAvailableCount} vehicles available for ${travelDate}`,
        totalCount,
        bookedCount: currentBookedCount,
        dateSpecificCount
      };
    }

    // If no date-specific record exists, use the general availability
    if (currentBookedCount >= totalCount) {
      return {
        available: false,
        message: `All ${totalCount} vehicles are booked for ${travelDate}`
      };
    }

    return {
      available: true,
      message: `${totalCount - currentBookedCount} vehicles available`,
      totalCount,
      bookedCount: currentBookedCount
    };
  } catch (error) {
    console.error("Error checking vehicle availability:", error);
    throw error;
  }
};

// Update the getAvailableTaxis function
const getAvailableTaxis = async (pickupLocation, dropLocation, date) => {
  try {
    const vehicleTypes = ["Sedan", "Hatchback", "SUV", "Prime_SUV"];
    const availableVehicles = [];

    for (const vehicleType of vehicleTypes) {
      const availability = await checkVehicleAvailability(vehicleType, date);
      
      if (availability.available) {
        availableVehicles.push({
          type: vehicleType,
          availableCount: availability.totalCount - availability.bookedCount,
          totalCount: availability.totalCount,
          bookedCount: availability.bookedCount,
          message: availability.message
        });
      } else {
        // Add unavailable vehicles with their status
        availableVehicles.push({
          type: vehicleType,
          availableCount: 0,
          totalCount: availability.totalCount || 0,
          bookedCount: availability.bookedCount || 0,
          message: availability.message,
          available: false
        });
      }
    }

    return {
      success: true,
      message: "Vehicle availability retrieved successfully",
      data: {
        pickupLocation,
        dropLocation,
        date,
        availableVehicles
      }
    };
  } catch (error) {
    console.error("Error getting available taxis:", error);
    return {
      success: false,
      message: "Failed to get available taxis",
      error: error.message
    };
  }
};

const findUserByNameAndMobile = async (name, mobile) => {
  try {
    const [users] = await pool.query(
      `SELECT user_id, name, email, mobile 
       FROM User 
       WHERE name LIKE ? AND mobile = ?`,
      [`%${name}%`, mobile]
    );

    if (users.length === 0) {
      return {
        success: false,
        message: "User not found"
      };
    }

    return {
      success: true,
      message: "User found",
      data: users[0]
    };
  } catch (error) {
    console.error("Error finding user:", error);
    return {
      success: false,
      message: "Failed to find user",
      error: error.message
    };
  }
};

const searchBookings = async (searchCriteria) => {
  try {
    // Validate search criteria
    if (!searchCriteria || !searchCriteria.userDetails) {
      return {
        success: false,
        message: "User details are required for searching bookings",
        data: []
      };
    }

    const { pickupLocation, dropLocation, date, vehicleType, userDetails } = searchCriteria;
    const { name, mobile } = userDetails;

    // Validate required user details
    if (!name || !mobile) {
      return {
        success: false,
        message: "Name and mobile number are required in userDetails",
        data: []
      };
    }

    console.log("Search Criteria:", searchCriteria);
    
    // First find the user by name and mobile
    const userResult = await findUserByNameAndMobile(name, mobile);
    
    if (!userResult.success) {
      return {
        success: false,
        message: "User not found",
        data: []
      };
    }

    const userId = userResult.data.user_id;
    
    // Build the query using the found user's ID
    let query = `
      SELECT 
        b.*,
        u.name as user_name,
        u.email as user_email,
        u.mobile as user_mobile,
        CASE 
          WHEN b.vehicle_type = 'Sedan' THEN t.Sedan_Price
          WHEN b.vehicle_type = 'Hatchback' THEN t.Hatchback_Price
          WHEN b.vehicle_type = 'SUV' THEN t.SUV_Price
          WHEN b.vehicle_type = 'Prime_SUV' THEN t.Prime_SUV_Price
        END as price
      FROM BookingTaxis b
      INNER JOIN User u ON b.user_id = u.user_id
      LEFT JOIN AvailableTaxis t ON b.pickup_location = t.pickup_location 
        AND b.drop_location = t.drop_location
      WHERE b.user_id = ?
    `;
    
    const queryParams = [userId];

    if (pickupLocation) {
      query += ` AND b.pickup_location LIKE ?`;
      queryParams.push(`%${pickupLocation}%`);
    }
    
    if (dropLocation) {
      query += ` AND b.drop_location LIKE ?`;
      queryParams.push(`%${dropLocation}%`);
    }

    if (date) {
      query += ` AND b.travel_date = ?`;
      queryParams.push(date);
    }

    if (vehicleType) {
      query += ` AND b.vehicle_type = ?`;
      queryParams.push(vehicleType);
    }

    query += ` ORDER BY b.booking_date DESC`;

    console.log('Search Query:', query);
    console.log('Query Parameters:', queryParams);

    const [bookings] = await pool.query(query, queryParams);

    const formattedBookings = bookings.map(booking => ({
      bookingId: booking.booking_id,
      bookingDate: booking.booking_date,
      travelDate: booking.travel_date,
      departureTime: "10:00", // Default time if not set
      vehicleType: booking.vehicle_type,
      numberOfPassengers: booking.number_of_passengers,
      pickupLocation: booking.pickup_location,
      dropLocation: booking.drop_location,
      price: booking.price,
      userDetails: {
        name: booking.user_name,
        email: booking.user_email,
        mobile: booking.user_mobile
      }
    }));

    return {
      success: true,
      message: "Bookings retrieved successfully",
      data: formattedBookings
    };
  } catch (error) {
    console.error("Error searching bookings:", error);
    return {
      success: false,
      message: "Failed to search bookings",
      error: error.message
    };
  }
};

// Add this function to drop and recreate tables
const dropAndRecreateTables = async () => {
  try {
    console.log("Starting table recreation process...");
    
    // Drop tables in reverse order of dependencies
    console.log("Dropping tables in correct order...");
    await pool.query('DROP TABLE IF EXISTS BookingTaxis');
    await pool.query('DROP TABLE IF EXISTS PastBookings');
    await pool.query('DROP TABLE IF EXISTS TaxiAvailabilityByDate');
    await pool.query('DROP TABLE IF EXISTS AvailableTaxis');
    await pool.query('DROP TABLE IF EXISTS User');
    console.log("All tables dropped successfully");

    // Create User table first
    console.log("Creating User table...");
    await pool.query(`
        CREATE TABLE User (
            user_id INT PRIMARY KEY AUTO_INCREMENT,
            username VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            mobile VARCHAR(20) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            isAdmin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("User table created successfully");

    // Create AvailableTaxis table
    console.log("Creating AvailableTaxis table...");
    await pool.query(`
        CREATE TABLE AvailableTaxis (
            TaxiID INT PRIMARY KEY AUTO_INCREMENT,
            pickup_location VARCHAR(100),
            drop_location VARCHAR(100),
            Sedan_Available INT DEFAULT 2,
            Sedan_Price DECIMAL(10,2) DEFAULT 1500.00,
            Hatchback_Available INT DEFAULT 4,
            Hatchback_Price DECIMAL(10,2) DEFAULT 1200.00,
            SUV_Available INT DEFAULT 1,
            SUV_Price DECIMAL(10,2) DEFAULT 2000.00,
            Prime_SUV_Available INT DEFAULT 1,
            Prime_SUV_Price DECIMAL(10,2) DEFAULT 2500.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("AvailableTaxis table created successfully");

    // Create BookingTaxis table
    console.log("Creating BookingTaxis table...");
    await pool.query(`
        CREATE TABLE BookingTaxis (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("BookingTaxis table created successfully");

    // Create PastBookings table
    console.log("Creating PastBookings table...");
    await pool.query(`
        CREATE TABLE PastBookings (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("PastBookings table created successfully");

    // Create TaxiAvailabilityByDate table
    console.log("Creating TaxiAvailabilityByDate table...");
    await pool.query(`
        CREATE TABLE TaxiAvailabilityByDate (
            id INT PRIMARY KEY AUTO_INCREMENT,
            travel_date DATE NOT NULL,
            vehicle_type VARCHAR(50) NOT NULL,
            pickup_location VARCHAR(100),
            drop_location VARCHAR(100),
            available_count INT DEFAULT 0,
            restoration_time DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY date_vehicle (travel_date, vehicle_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("TaxiAvailabilityByDate table created successfully");

    // Insert a default admin user
    console.log("Creating default admin user...");
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await pool.query(`
        INSERT INTO User (username, name, email, mobile, password, isAdmin)
        VALUES ('admin', 'Admin User', 'admin@example.com', '1234567890', ?, true)
    `, [hashedPassword]);
    console.log("Default admin user created successfully");

    // Insert some initial taxi inventory
    console.log("Inserting initial taxi inventory...");
    await pool.query(`
        INSERT INTO AvailableTaxis (
            pickup_location, 
            drop_location, 
            Sedan_Available, 
            Sedan_Price,
            Hatchback_Available,
            Hatchback_Price,
            SUV_Available,
            SUV_Price,
            Prime_SUV_Available,
            Prime_SUV_Price
        ) VALUES 
        ('Mumbai', 'Pune', 4, 1500.00, 2, 1200.00, 1, 2000.00, 1, 2500.00),
        ('Pune', 'Mumbai', 4, 1500.00, 2, 1200.00, 1, 2000.00, 1, 2500.00)
    `);
    console.log("Initial taxi inventory inserted successfully");

    console.log("All tables recreated successfully");
    return {
        success: true,
        message: "All tables recreated successfully"
    };
  } catch (error) {
    console.error("Error recreating tables:", error);
    console.error("Error initializing booking service:", error);
    throw error;
  }
};

// Add this function to create tables if they don't exist
const createTablesIfNotExist = async () => {
  try {
    console.log("Checking and creating tables if they don't exist...");
    
    // Check if User table exists
    const [userTableExists] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'User'
    `);
    
    if (userTableExists[0].count === 0) {
      console.log("Creating User table...");
      await pool.query(`
          CREATE TABLE User (
              user_id INT PRIMARY KEY AUTO_INCREMENT,
              username VARCHAR(255) NOT NULL,
              name VARCHAR(255) NOT NULL,
              email VARCHAR(255) UNIQUE NOT NULL,
              mobile VARCHAR(20) UNIQUE NOT NULL,
              password VARCHAR(255) NOT NULL,
              isAdmin BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
      `);
      console.log("User table created successfully");
    } else {
      console.log("User table already exists");
    }
    
    // Check if AvailableTaxis table exists
    const [availableTaxisTableExists] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'AvailableTaxis'
    `);
    
    if (availableTaxisTableExists[0].count === 0) {
      console.log("Creating AvailableTaxis table...");
      await pool.query(`
          CREATE TABLE AvailableTaxis (
              TaxiID INT PRIMARY KEY AUTO_INCREMENT,
              pickup_location VARCHAR(100),
              drop_location VARCHAR(100),
              Sedan_Available INT DEFAULT 2,
              Sedan_Price DECIMAL(10,2) DEFAULT 1500.00,
              Hatchback_Available INT DEFAULT 4,
              Hatchback_Price DECIMAL(10,2) DEFAULT 1200.00,
              SUV_Available INT DEFAULT 1,
              SUV_Price DECIMAL(10,2) DEFAULT 2000.00,
              Prime_SUV_Available INT DEFAULT 1,
              Prime_SUV_Price DECIMAL(10,2) DEFAULT 2500.00,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("AvailableTaxis table created successfully");
    } else {
      console.log("AvailableTaxis table already exists");
    }
    
    // Check if TaxiAvailabilityByDate table exists
    const [taxiAvailabilityTableExists] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'TaxiAvailabilityByDate'
    `);
    
    if (taxiAvailabilityTableExists[0].count === 0) {
      console.log("Creating TaxiAvailabilityByDate table...");
      await pool.query(`
          CREATE TABLE TaxiAvailabilityByDate (
              id INT PRIMARY KEY AUTO_INCREMENT,
              travel_date DATE NOT NULL,
              vehicle_type VARCHAR(50) NOT NULL,
              pickup_location VARCHAR(100),
              drop_location VARCHAR(100),
              available_count INT DEFAULT 0,
              restoration_time DATETIME,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY date_vehicle (travel_date, vehicle_type)
          )
      `);
      console.log("TaxiAvailabilityByDate table created successfully");
    } else {
      console.log("TaxiAvailabilityByDate table already exists");
    }
    
    // Check if PastBookings table exists
    const [pastBookingsTableExists] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'PastBookings'
    `);
    
    if (pastBookingsTableExists[0].count === 0) {
      console.log("Creating PastBookings table...");
      await pool.query(`
          CREATE TABLE PastBookings (
              booking_id INT PRIMARY KEY AUTO_INCREMENT,
              user_id INT NOT NULL,
              booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              travel_date DATE NOT NULL,
              departure_time TIME,
              vehicle_type VARCHAR(50) NOT NULL,
              number_of_passengers INT NOT NULL,
              pickup_location VARCHAR(255) NOT NULL,
              drop_location VARCHAR(255) NOT NULL,
              price DECIMAL(10,2) NOT NULL,
              status VARCHAR(50) DEFAULT 'CONFIRMED',
              travel_type VARCHAR(50) DEFAULT 'One Way',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES User(user_id)
          )
      `);
      console.log("PastBookings table created successfully");
    } else {
      console.log("PastBookings table already exists");
    }
    
    // Check if BookingTaxis table exists
    const [bookingTaxisTableExists] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'BookingTaxis'
    `);
    
    if (bookingTaxisTableExists[0].count === 0) {
      console.log("Creating BookingTaxis table...");
      await pool.query(`
          CREATE TABLE BookingTaxis (
              booking_id INT PRIMARY KEY AUTO_INCREMENT,
              user_id INT NOT NULL,
              booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              travel_date DATE NOT NULL,
              departure_time TIME,
              vehicle_type VARCHAR(50) NOT NULL,
              number_of_passengers INT NOT NULL,
              pickup_location VARCHAR(255) NOT NULL,
              drop_location VARCHAR(255) NOT NULL,
              price DECIMAL(10,2) NOT NULL,
              status VARCHAR(50) DEFAULT 'CONFIRMED',
              travel_type VARCHAR(50) DEFAULT 'One Way',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES User(user_id)
          )
      `);
      console.log("BookingTaxis table created successfully");
    } else {
      console.log("BookingTaxis table already exists");
    }
    
    console.log("All tables checked/created successfully");
    return { success: true, message: "Tables checked/created successfully" };
  } catch (error) {
    console.error("Error creating tables:", error);
    return {
      success: false,
      message: "Failed to create tables",
      error: error.message
    };
  }
};

const cancelBooking = async (bookingId) => {
  try {
    // Start a transaction
    await pool.query('START TRANSACTION');

    try {
      // First check if it's a past booking
      const [pastBookings] = await pool.query(
        'SELECT * FROM PastBookings WHERE booking_id = ?',
        [bookingId]
      );

      if (pastBookings.length > 0) {
        await pool.query('ROLLBACK');
        return {
          success: false,
          message: "This is a past booking that has already been completed or cancelled"
        };
      }

      // Get the booking details from BookingTaxis
      const [bookings] = await pool.query(
        'SELECT * FROM BookingTaxis WHERE booking_id = ? AND status = "confirmed"',
        [bookingId]
      );

      if (bookings.length === 0) {
        await pool.query('ROLLBACK');
        return {
          success: false,
          message: "Booking not found or already cancelled/completed"
        };
      }

      const booking = bookings[0];

      // Check if it's a past booking (travel date is before today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const travelDate = new Date(booking.travel_date);
      travelDate.setHours(0, 0, 0, 0);

      if (travelDate < today) {
        // For past bookings, move to PastBookings with 'completed' status
        await pool.query(
          `INSERT INTO PastBookings (
            booking_id, booking_date, travel_date, vehicle_type,
            number_of_passengers, pickup_location, drop_location,
            user_id, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
          [
            booking.booking_id,
            booking.booking_date,
            booking.travel_date,
            booking.vehicle_type,
            booking.number_of_passengers,
            booking.pickup_location,
            booking.drop_location,
            booking.user_id
          ]
        );

        // Delete from BookingTaxis
        await pool.query(
          'DELETE FROM BookingTaxis WHERE booking_id = ?',
          [bookingId]
        );

        await pool.query('COMMIT');

        return {
          success: false,
          message: "This is a past booking that has been marked as completed"
        };
      }

      // For current/future bookings, proceed with cancellation
      await pool.query(
        `INSERT INTO PastBookings (
          booking_id, booking_date, travel_date, vehicle_type,
          number_of_passengers, pickup_location, drop_location,
          user_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cancelled')`,
        [
          booking.booking_id,
          booking.booking_date,
          booking.travel_date,
          booking.vehicle_type,
          booking.number_of_passengers,
          booking.pickup_location,
          booking.drop_location,
          booking.user_id
        ]
      );

      // Delete from TaxiAvailabilityByDate
      await pool.query(
        `DELETE FROM TaxiAvailabilityByDate 
         WHERE travel_date = ? AND vehicle_type = ?`,
        [booking.travel_date, booking.vehicle_type]
      );

      // For same-day bookings, also update AvailableTaxis table
      if (travelDate.toDateString() === today.toDateString()) {
        let checkColumn;
        switch (booking.vehicle_type) {
          case "Sedan": checkColumn = "Sedan_Available"; break;
          case "Hatchback": checkColumn = "Hatchback_Available"; break;
          case "SUV": checkColumn = "SUV_Available"; break;
          case "Prime_SUV": checkColumn = "Prime_SUV_Available"; break;
        }

        await pool.query(
          `UPDATE AvailableTaxis 
           SET ${checkColumn} = ${checkColumn} + 1
           WHERE pickup_location = ? AND drop_location = ?`,
          [booking.pickup_location, booking.drop_location]
        );
      }

      // Delete from BookingTaxis
      await pool.query(
        'DELETE FROM BookingTaxis WHERE booking_id = ?',
        [bookingId]
      );

      await pool.query('COMMIT');

      return {
        success: true,
        message: "Booking cancelled successfully",
        data: {
          bookingId: booking.booking_id,
          travelDate: booking.travel_date,
          vehicleType: booking.vehicle_type,
          pickupLocation: booking.pickup_location,
          dropLocation: booking.drop_location
        }
      };
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return {
      success: false,
      message: "Failed to cancel booking",
      error: error.message
    };
  }
};

// Update module exports
module.exports = {
  createBooking,
  handleExpiredBookings,
  restoreAvailability,
  handlePendingRestorations,
  getCurrentAvailability,
  processFutureBookings,
  clearTableData,
  checkVehicleAvailability,
  getAvailableTaxis,
  searchBookings,
  dropAndRecreateTables,
  createTablesIfNotExist,
  cancelBooking
};
