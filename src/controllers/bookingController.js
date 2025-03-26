const { createBooking, searchBookings } = require('../services/bookingService');

const createBookingDetails = async (req, res) => {
    try {
        const bookingData = req.body;
        console.log("req.body from booking", req.body);
        
        // Validate required fields
        if (!bookingData.travelDate || !bookingData.vehicleType || 
            !bookingData.pickupLocation || !bookingData.dropLocation || 
            !bookingData.userDetails) {
            return res.status(400).json({
                success: false,
                message: "Missing required booking details"
            });
        }

        const result = await createBooking(bookingData);

        if (result.success) {
            return res.status(201).json(result);
        } else {
            return res.status(400).json(result);
        }

    } catch (error) {
        console.error("Error in createBookingDetails:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const searchBookingsController = async (req, res) => {
  try {
    console.log("Received search request headers:", req.headers);
    console.log("Received search request body:", req.body);
    
    // Check if request body is empty
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body is empty. Please provide search criteria.",
        data: []
      });
    }
    
    const { pickupLocation, dropLocation, date, vehicleType, userDetails } = req.body;
    
    // Log the extracted data
    console.log("Extracted search parameters:", {
      pickupLocation,
      dropLocation,
      date,
      vehicleType,
      userDetails
    });
    
    // Validate user details
    if (!userDetails) {
      return res.status(400).json({
        success: false,
        message: "User details are required",
        data: []
      });
    }

    if (!userDetails.name || !userDetails.mobile) {
      return res.status(400).json({
        success: false,
        message: "User name and mobile number are required",
        data: []
      });
    }
    
    const searchCriteria = {
      pickupLocation,
      dropLocation,
      date,
      vehicleType,
      userDetails
    };

    console.log("Search criteria prepared:", searchCriteria);
    const result = await searchBookings(searchCriteria);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error in searchBookings controller:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
    createBookingDetails,
    searchBookingsController
}; 