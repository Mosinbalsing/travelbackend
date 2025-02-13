const { pool } = require("../config/db");

const getAvailableTaxis = async (pickupLocation, dropLocation, date) => {
    console.log("pickupLocation:", pickupLocation);
    console.log("dropLocation:", dropLocation);
    console.log("date:", date);

    try {
        // Validate input parameters
        if (!pickupLocation || !dropLocation || !date) {
            return {
                success: false,
                message: "Pickup location, drop location, and date are required"
            };
        }

        // Query to fetch available taxis
        const [rows] = await pool.query(`
            SELECT 
                TaxiID,
                PickupLocation,
                DropLocation,
                AvailableDate,
                SeatingCapacity,
                CASE WHEN  Hatchback_isAvailable= TRUE THEN
                    JSON_OBJECT(
                        'type', 'Sedan',
                        'price', Sedan_Price,
                        'vehicleNumber', Sedan_VehicleNumber,
                        'seatingCapacity', SeatingCapacity
                    )
                    ELSE NULL
                END as Sedan,
                CASE WHEN Sedan_isAvailable = TRUE THEN
                    JSON_OBJECT(
                        'type', 'Hatchback',
                        'price', Hatchback_Price,
                        'vehicleNumber', Hatchback_VehicleNumber,
                        'seatingCapacity', SeatingCapacity
                    )
                    ELSE NULL
                END as Hatchback,
                CASE WHEN SUV_isAvailable = TRUE THEN
                    JSON_OBJECT(
                        'type', 'SUV',
                        'price', SUV_Price,
                        'vehicleNumber', SUV_VehicleNumber,
                        'seatingCapacity', SeatingCapacity
                    )
                    ELSE NULL
                END as SUV,
                CASE WHEN Prime_SUV_isAvailable = TRUE THEN
                    JSON_OBJECT(
                        'type', 'Prime SUV',
                        'price', Prime_SUV_Price,
                        'vehicleNumber', Prime_SUV_VehicleNumber,
                        'seatingCapacity', SeatingCapacity
                    )
                    ELSE NULL
                END as Prime_SUV
            FROM AvailableTaxis 
            WHERE PickupLocation = ? 
            AND DropLocation = ? 
            AND (Sedan_isAvailable = TRUE 
                OR Hatchback_isAvailable = TRUE 
                OR SUV_isAvailable = TRUE 
                OR Prime_SUV_isAvailable = TRUE)
        `, [pickupLocation, dropLocation, date]);

        // If no taxis are found
        if (rows.length === 0) {
            return {
                success: false,
                message: "No taxis available for this route and date"
            };
        }

        // Process the results to include only available vehicles
        const availableVehicles = [];
        
        const processedData = rows.map(row => {

            if (row.Hatchback) availableVehicles.push(row.Hatchback);
            if (row.Sedan) availableVehicles.push(row.Sedan);
            if (row.SUV) availableVehicles.push(row.SUV);
            if (row.Prime_SUV) availableVehicles.push(row.Prime_SUV);

            senddata = {
                routeId: row.TaxiID,
                pickupLocation: row.PickupLocation,
                dropLocation: row.DropLocation,
                availableDate: row.AvailableDate,
                availableVehicles: availableVehicles
            };
        });
        

        
        console.log("processedData:", processedData);
        return {
            success: true,
            message: "Available taxis found successfully",
            data: {availableVehicles}
        };
    } catch (error) {
        console.error("Error fetching available taxis:", error);
        return {
            success: false,
            message: "Failed to fetch available taxis",
            error: error.message
        };
    }
};

module.exports = { getAvailableTaxis };