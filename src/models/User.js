const User = sequelize.define('User', {
    // ... other fields ...
    mobile: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    // ... other fields ...
}); 