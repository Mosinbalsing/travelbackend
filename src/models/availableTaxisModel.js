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
        this.Sedan_Available = taxi.Sedan_Available;
        this.Hatchback_Available = taxi.Hatchback_Available;
        this.SUV_Available = taxi.SUV_Available;
        this.Prime_SUV_Available = taxi.Prime_SUV_Available;
    }
}

module.exports = { AvailableTaxisModel }; 