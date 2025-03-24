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
      (currentHour > 20 || (currentHour === 20 && currentMinutes > 0))
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
          message: "No vehicles available for this date",
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

      // Update TaxiAvailabilityByDate
      await pool.query(
        `INSERT INTO TaxiAvailabilityByDate 
        (travel_date, vehicle_type, pickup_location, drop_location, available_count)
        VALUES (?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE 
        available_count = available_count + 1`,
        [
          bookingData.travelDate,
          bookingData.vehicleType,
          bookingData.pickupLocation,
          bookingData.dropLocation,
        ]
      );

      // Handle taxi count based on travel date
      if (travelDate.toDateString() === today.toDateString()) {
        // For today's bookings, decrement immediately
        await pool.query(
          `UPDATE AvailableTaxis 
                    SET ${checkColumn} = ${checkColumn} - 1
                    WHERE ${checkColumn} > 0
                    AND PickupLocation = ?
                    AND DropLocation = ?`,
          [bookingData.pickupLocation, bookingData.dropLocation]
        );

        // Schedule increment after 2 minutes
        setTimeout(async () => {
          try {
            await pool.query(
              `UPDATE AvailableTaxis 
                            SET ${checkColumn} = ${checkColumn} + 1
                            WHERE PickupLocation = ? 
                            AND DropLocation = ?`,
              [bookingData.pickupLocation, bookingData.dropLocation]
            );
            console.log(
              `Incremented availability for booking ${result.insertId} after 2 minutes`
            );
          } catch (error) {
            console.error("Error in scheduled increment:", error);
          }
        }, 2 * 60 * 1000); // 2 minutes in milliseconds
      } else {
        // For future dates, schedule the decrement for the travel date
        const travelDateTime = new Date(bookingData.travelDate);
        travelDateTime.setHours(0, 0, 0, 0); // Start of the travel date

        const now = new Date();
        const delayMs = travelDateTime.getTime() - now.getTime();

        if (delayMs > 0) {
          setTimeout(async () => {
            try {
              // Decrement at start of travel date for all routes
              await pool.query(
                `UPDATE AvailableTaxis 
                                SET ${checkColumn} = ${checkColumn} - 1
                                WHERE ${checkColumn} > 0`
              );
              console.log(
                `Decremented availability for booking ${result.insertId} on travel date`
              );

              // Schedule increment after 2 minutes for all routes
              setTimeout(async () => {
                try {
                  await pool.query(
                    `UPDATE AvailableTaxis 
                                        SET ${checkColumn} = ${checkColumn} + 1
                                        WHERE ${checkColumn} < (
                                            SELECT original_count 
                                            FROM (
                                                SELECT ${checkColumn} as original_count 
                                                FROM AvailableTaxis 
                                                WHERE PickupLocation = ? 
                                                AND DropLocation = ?
                                            ) as original
                                        )`,
                    [bookingData.pickupLocation, bookingData.dropLocation]
                  );
                  console.log(
                    `Incremented availability for booking ${result.insertId} after 2 minutes`
                  );
                } catch (error) {
                  console.error("Error in scheduled increment:", error);
                }
              }, 2 * 60 * 1000); // 2 minutes in milliseconds
            } catch (error) {
              console.error("Error in scheduled decrement:", error);
            }
          }, delayMs);
        }
      }

      await pool.query("COMMIT");

      // Schedule restoration for the specific date
      const restorationTime = new Date(bookingData.travelDate);
      restorationTime.setHours(23, 59, 59); // End of the travel date

      const now = new Date();
      const delayMs = restorationTime.getTime() - now.getTime();

      setTimeout(async () => {
        try {
          await restoreAvailability(
            bookingData.vehicleType,
            bookingData.travelDate
          );
          console.log(
            `Restored availability for booking ${result.insertId} after travel date`
          );
        } catch (error) {
          console.error("Error in scheduled restoration:", error);
        }
      }, delayMs);

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

// Add a function to get current availability
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
            SELECT vehicle_type, COUNT(*) as count
            FROM BookingTaxis 
            WHERE travel_date < CURDATE() 
            AND status = 'confirmed'
            GROUP BY vehicle_type
        `);

    // Restore availability for each vehicle type
    for (const booking of expiredBookings) {
      await restoreAvailability(booking.vehicle_type, booking.travel_date);
    }

    // Update status of expired bookings
    await pool.query(`
            UPDATE BookingTaxis 
            SET status = 'completed' 
            WHERE travel_date < CURDATE() 
            AND status = 'confirmed'
        `);
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

// Add a function to process future bookings
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

      // Decrement available taxis
      await pool.query(
        `UPDATE AvailableTaxis 
         SET ${checkColumn} = ${checkColumn} - 1
         WHERE PickupLocation = ? 
         AND DropLocation = ?`,
        [booking.pickup_location, booking.drop_location]
      );

      // Schedule increment after 2 minutes
      setTimeout(async () => {
        try {
          await pool.query(
            `UPDATE AvailableTaxis 
             SET ${checkColumn} = ${checkColumn} + 1
             WHERE PickupLocation = ? 
             AND DropLocation = ?`,
            [booking.pickup_location, booking.drop_location]
          );
          console.log(
            `Incremented availability for booking ${booking.booking_id} after 2 minutes`
          );
        } catch (error) {
          console.error("Error in scheduled increment:", error);
        }
      }, 2 * 60 * 1000); // 2 minutes in milliseconds
    }
  } catch (error) {
    console.error("Error processing future bookings:", error);
  }
};

// Call processFutureBookings every hour
setInterval(processFutureBookings, 60 * 60 * 1000);

// Update module exports
module.exports = {
  createBooking,
  handleExpiredBookings,
  restoreAvailability,
  handlePendingRestorations,
  getCurrentAvailability,
  processFutureBookings
};
