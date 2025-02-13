class AvailableTaxisModel {
    constructor(taxi) {
        this.TaxiID = taxi.TaxiID;
        this.UserID = taxi.UserID;
        this.PickupLocation = taxi.PickupLocation;
        this.DropLocation = taxi.DropLocation;
        this.Sedan_Price = taxi.Sedan_Price;
        this.Hatchback_Price = taxi.Hatchback_Price;
        this.SUV_Price = taxi.SUV_Price;
        this.Prime_SUV_Price = taxi.Prime_SUV_Price;
        this.Sedan_isAvailable = taxi.Sedan_isAvailable;
        this.Hatchback_isAvailable = taxi.Hatchback_isAvailable;
        this.SUV_isAvailable = taxi.SUV_isAvailable;
        this.Prime_SUV_isAvailable = taxi.Prime_SUV_isAvailable;
        this.Sedan_VehicleNumber = taxi.Sedan_VehicleNumber;
        this.Hatchback_VehicleNumber = taxi.Hatchback_VehicleNumber;
        this.SUV_VehicleNumber = taxi.SUV_VehicleNumber;
        this.Prime_SUV_VehicleNumber = taxi.Prime_SUV_VehicleNumber;
        this.SeatingCapacity = taxi.SeatingCapacity;
        this.AvailableDate = taxi.AvailableDate || new Date();
    }
}

module.exports = { AvailableTaxisModel }; 