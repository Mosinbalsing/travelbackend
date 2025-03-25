const { pool } = require("../config/db");

const createBookingTable = async () => {
  try {
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
            )
        `);

    // Create TaxiAvailabilityByDate table
    await pool.query(`
            CREATE TABLE IF NOT EXISTS TaxiAvailabilityByDate (
                id INT PRIMARY KEY AUTO_INCREMENT,
                travel_date DATE,
                vehicle_type VARCHAR(50),
                pickup_location VARCHAR(100),
                drop_location VARCHAR(100),
                available_count INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

    console.log("Tables created successfully");
  } catch (error) {
    console.error("Error creating tables:", error);
    throw error;
  }
};

const createBooking = async (bookingData) => {
  try {
    await createBookingTable();

    // Validate vehicle type
    const validVehicleTypes = ["Sedan", "Hatchback", "SUV", "Prime_SUV"];
    if (!validVehicleTypes.includes(bookingData.vehicleType)) {
      console.log("Invalid vehicle type:", bookingData.vehicleType);
      return {
        success: false,
        message: `Invalid vehicle type. Must be one of: ${validVehicleTypes.join(", ")}`,
      };
    }

    // Validate travel date and time
    const travelDate = new Date(bookingData.travelDate);
    const today = new Date();
    const currentHour = today.getHours();
    const currentMinutes = today.getMinutes();

    // If booking is for today and current time is past 7 PM
    if (
      travelDate.toDateString() === today.toDateString() &&
      (currentHour > 22 || (currentHour === 22 && currentMinutes > 0))
    ) { 
      return {
        success: false,
        message: "Cannot create bookings after 7 PM for today",
      };
    }

    const [user] = await pool.query(
      "SELECT user_id FROM User WHERE mobile = ?",
      [bookingData.userDetails.mobile]
    );

    if (!user || user.length === 0) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const userId = user[0].user_id;
    const currentDateTime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // Start a transaction
    await pool.query("START TRANSACTION");

    try {
      let checkColumn;
      switch (bookingData.vehicleType) {
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

      // Check availability considering existing bookings for the travel date
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
                AND a.PickupLocation = ?
                AND a.DropLocation = ?`,
        [
          bookingData.vehicleType,
          bookingData.travelDate,
          bookingData.pickupLocation,
          bookingData.dropLocation,
        ]
      );

      if (!availability || availability.length === 0) {
        await pool.query("ROLLBACK");
        return {
          success: false,
          message: `No ${bookingData.vehicleType} vehicles available for this date. All vehicles are already booked.`,
        };
      }

      // Double check the current booking count for this vehicle type and date
      const [currentBookings] = await pool.query(
        `SELECT COUNT(*) as booked_count
         FROM BookingTaxis
         WHERE vehicle_type = ?
         AND travel_date = ?
         AND status = 'confirmed'`,
        [bookingData.vehicleType, bookingData.travelDate]
      );

      const bookedCount = currentBookings[0].booked_count;
      const availableCount = availability[0][checkColumn];

      if (bookedCount >= availableCount) {
        await pool.query("ROLLBACK");
        return {
          success: false,
          message: `Cannot book ${bookingData.vehicleType}. All ${availableCount} vehicles are already booked for this date.`,
        };
      }

      // Insert booking
      const [result] = await pool.query(
        `INSERT INTO BookingTaxis (
                    booking_date,
                    travel_date,
                    vehicle_type,
                    number_of_passengers,
                    pickup_location,
                    drop_location,
                    user_id,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
        [
          currentDateTime,
          bookingData.travelDate,
          bookingData.vehicleType,
          bookingData.numberOfPassengers || 1,
          bookingData.pickupLocation,
          bookingData.dropLocation,
          userId,
        ]
      );

      // Handle taxi count based on travel date
      if (travelDate.toDateString() === today.toDateString()) {
        // For today's bookings, decrement for all routes but ensure it doesn't go below 0
        await pool.query(
          `UPDATE AvailableTaxis 
                    SET ${checkColumn} = GREATEST(${checkColumn} - 1, 0)
                    WHERE ${checkColumn} > 0`,
          []
        );

        // Update TaxiAvailabilityByDate for today only
        await pool.query(
          `INSERT INTO TaxiAvailabilityByDate 
          (travel_date, vehicle_type, available_count)
          VALUES (?, ?, 1)
          ON DUPLICATE KEY UPDATE 
          available_count = available_count + 1`,
          [bookingData.travelDate, bookingData.vehicleType]
        );

        // Schedule availability restoration after 2 minutes
        const twoMinutesLater = new Date();
        twoMinutesLater.setMinutes(twoMinutesLater.getMinutes() + 2);

        // Store the restoration time in the database
        await pool.query(
          `INSERT INTO TaxiAvailabilityByDate 
          (travel_date, vehicle_type, available_count, restoration_time)
          VALUES (?, ?, 1, ?)
          ON DUPLICATE KEY UPDATE 
          restoration_time = ?`,
          [bookingData.travelDate, bookingData.vehicleType, twoMinutesLater, twoMinutesLater]
        );
      } else {
        // For future dates, only update TaxiAvailabilityByDate for the specific date
        await pool.query(
          `INSERT INTO TaxiAvailabilityByDate 
          (travel_date, vehicle_type, available_count)
          VALUES (?, ?, 1)
          ON DUPLICATE KEY UPDATE 
          available_count = available_count + 1`,
          [bookingData.travelDate, bookingData.vehicleType]
        );
      }

      await pool.query("COMMIT");

      // Schedule restoration for the end of the travel date
      const restorationTime = new Date(bookingData.travelDate);
      restorationTime.setHours(23, 59, 59); // End of the travel date

      const now = new Date();
      const delayMs = restorationTime.getTime() - now.getTime();

      if (delayMs > 0) {
        setTimeout(async () => {
          try {
            // Restore availability at the end of the travel date, but don't exceed original count
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

            // Update booking status only for the specific date
            await pool.query(
              `UPDATE BookingTaxis 
               SET status = 'completed'
               WHERE vehicle_type = ?
               AND travel_date = ?
               AND status = 'confirmed'`,
              [bookingData.vehicleType, bookingData.travelDate]
            );

            console.log(
              `Restored availability for booking ${result.insertId} after travel date`
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
          booking_id: result.insertId,
          bookingDate: currentDateTime,
          travelDate: bookingData.travelDate,
          vehicleType: bookingData.vehicleType,
          numberOfPassengers: bookingData.numberOfPassengers,
          pickupLocation: bookingData.pickupLocation,
          dropLocation: bookingData.dropLocation,
          userDetails: bookingData.userDetails,
        },
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
      error: error.message,
    };
  }
};

// Update restore availability function to work with dates
const restoreAvailability = async (vehicleType, travelDate) => {
  try {
    let updateColumn;
    switch (vehicleType) {
      case "Sedan":
        updateColumn = "Sedan_Available";
        break;
      case "Hatchback":
        updateColumn = "Hatchback_Available";
        break;
      case "SUV":
        updateColumn = "SUV_Available";
        break;
      case "Prime_SUV":
        updateColumn = "Prime_SUV_Available";
        break;
      default:
        throw new Error("Invalid vehicle type");
    }

    // Update booking status first
    await pool.query(
      `UPDATE BookingTaxis 
             SET status = 'completed'
             WHERE vehicle_type = ?
             AND travel_date = ?
             AND status = 'confirmed'`,
      [vehicleType, travelDate]
    );

    console.log(`Restored availability for ${vehicleType} on ${travelDate}`);
    return true;
  } catch (error) {
    console.error("Error restoring availability:", error);
    throw error;
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
    const [pendingBookings] = await pool.query(`
            SELECT booking_id, vehicle_type
            FROM BookingTaxis
            WHERE status = 'confirmed'
            AND booking_date >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            GROUP BY vehicle_type
        `);

    for (const booking of pendingBookings) {
      await restoreAvailability(booking.vehicle_type, booking.travel_date);
      console.log(
        `Restored availability for pending bookings of type ${booking.vehicle_type}`
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
      await pool.query("TRUNCATE TABLE TaxiAvailabilityByDate");
      
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

    // Check if vehicle is available for the specific date
    const [availability] = await pool.query(
      `SELECT 
        a.${checkColumn} as total_count,
        COALESCE(b.booked_count, 0) as booked_count,
        COALESCE(t.restoration_time, NULL) as restoration_time
      FROM AvailableTaxis a
      LEFT JOIN (
        SELECT COUNT(*) as booked_count
        FROM BookingTaxis
        WHERE vehicle_type = ?
        AND travel_date = ?
        AND status = 'confirmed'
      ) b ON 1=1
      LEFT JOIN TaxiAvailabilityByDate t ON t.vehicle_type = ?
      AND t.travel_date = ?`,
      [vehicleType, travelDate, vehicleType, travelDate]
    );

    if (!availability || availability.length === 0) {
      return {
        available: false,
        message: "No vehicles available"
      };
    }

    const totalCount = availability[0].total_count;
    const bookedCount = availability[0].booked_count;
    const restorationTime = availability[0].restoration_time;

    // If all vehicles are booked for this date
    if (bookedCount >= totalCount) {
      return {
        available: false,
        message: `All ${totalCount} vehicles are booked for ${travelDate}. Vehicle is not available for any route on this date.`
      };
    }

    // If vehicle is temporarily unavailable (within 2-minute window)
    if (restorationTime && new Date(restorationTime) > new Date()) {
      return {
        available: false,
        message: "Vehicle is temporarily unavailable",
        nextAvailable: restorationTime
      };
    }

    return {
      available: true,
      message: `${totalCount - bookedCount} vehicles available`,
      totalCount,
      bookedCount
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
  getAvailableTaxis
};
