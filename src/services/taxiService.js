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

        // Query to fetch available taxis with counts
        const [rows] = await pool.query(`
            SELECT 
                t.TaxiID,
                t.PickupLocation,
                t.DropLocation,
                CASE WHEN t.Sedan_Available > 
                    (SELECT COUNT(*) FROM BookedTaxis 
                     WHERE TaxiID = t.TaxiID AND VehicleType = 'Sedan' 
                     AND BookedDate = ?) 
                THEN JSON_OBJECT(
                    'type', 'Sedan',
                    'price', t.Sedan_Price,
                    'availableCount', t.Sedan_Available - COALESCE(
                        (SELECT COUNT(*) FROM BookedTaxis 
                         WHERE TaxiID = t.TaxiID AND VehicleType = 'Sedan' 
                         AND BookedDate = ?), 0)
                )
                ELSE NULL END as Sedan,
                CASE WHEN t.Hatchback_Available > 
                    (SELECT COUNT(*) FROM BookedTaxis 
                     WHERE TaxiID = t.TaxiID AND VehicleType = 'Hatchback' 
                     AND BookedDate = ?) 
                THEN JSON_OBJECT(
                    'type', 'Hatchback',
                    'price', t.Hatchback_Price,
                    'availableCount', t.Hatchback_Available - COALESCE(
                        (SELECT COUNT(*) FROM BookedTaxis 
                         WHERE TaxiID = t.TaxiID AND VehicleType = 'Hatchback' 
                         AND BookedDate = ?), 0)
                )
                ELSE NULL END as Hatchback,
                CASE WHEN t.SUV_Available > 
                    (SELECT COUNT(*) FROM BookedTaxis 
                     WHERE TaxiID = t.TaxiID AND VehicleType = 'SUV' 
                     AND BookedDate = ?) 
                THEN JSON_OBJECT(
                    'type', 'SUV',
                    'price', t.SUV_Price,
                    'availableCount', t.SUV_Available - COALESCE(
                        (SELECT COUNT(*) FROM BookedTaxis 
                         WHERE TaxiID = t.TaxiID AND VehicleType = 'SUV' 
                         AND BookedDate = ?), 0)
                )
                ELSE NULL END as SUV,
                CASE WHEN t.Prime_SUV_Available > 
                    (SELECT COUNT(*) FROM BookedTaxis 
                     WHERE TaxiID = t.TaxiID AND VehicleType = 'Prime_SUV' 
                     AND BookedDate = ?) 
                THEN JSON_OBJECT(
                    'type', 'Prime_SUV',
                    'price', t.Prime_SUV_Price,
                    'availableCount', t.Prime_SUV_Available - COALESCE(
                        (SELECT COUNT(*) FROM BookedTaxis 
                         WHERE TaxiID = t.TaxiID AND VehicleType = 'Prime_SUV' 
                         AND BookedDate = ?), 0)
                )
                ELSE NULL END as Prime_SUV
            FROM AvailableTaxis t
            WHERE t.PickupLocation = ? 
            AND t.DropLocation = ?
        `, [date, date, date, date, date, date, date, date, pickupLocation, dropLocation]);

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
            if (row.Sedan) availableVehicles.push(row.Sedan);
            if (row.Hatchback) availableVehicles.push(row.Hatchback);
            if (row.SUV) availableVehicles.push(row.SUV);
            if (row.Prime_SUV) availableVehicles.push(row.Prime_SUV);

            senddata = {
                routeId: row.TaxiID,
                pickupLocation: row.PickupLocation,
                dropLocation: row.DropLocation,
                availableDate: date,
                availableVehicles: availableVehicles
            };
        });
        

        
        console.log("processedData:", availableVehicles);
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