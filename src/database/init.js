const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const initializeDatabase = async () => {
    try {
        // Read the schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Split the schema into individual statements
        const statements = schema
            .split(';')
            .filter(statement => statement.trim());

        // Execute each statement
        for (const statement of statements) {
            if (statement.trim()) {
                await pool.query(statement);
                console.log('Executed SQL statement successfully');
            }
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
};

module.exports = { initializeDatabase }; 