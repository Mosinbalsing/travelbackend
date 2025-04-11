const { pool } = require('../config/db');

const createContactTable = async () => {
    try {
        // Check if table exists
        const [tables] = await pool.execute(
            "SHOW TABLES LIKE 'ContactMessages'"
        );

        if (tables.length === 0) {
            // Table doesn't exist, create it
            await pool.execute(`
                CREATE TABLE ContactMessages (
                    contact_id VARCHAR(10) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    subject VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('ContactMessages table created successfully');
        } else {
            // Table exists, check if it has the correct schema
            const [columns] = await pool.execute(
                "SHOW COLUMNS FROM ContactMessages LIKE 'contact_id'"
            );
            
            if (columns.length === 0) {
                // Table exists but has wrong schema, drop and recreate
                await pool.execute('DROP TABLE ContactMessages');
                await pool.execute(`
                    CREATE TABLE ContactMessages (
                        contact_id VARCHAR(10) PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) NOT NULL,
                        subject VARCHAR(255) NOT NULL,
                        message TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('ContactMessages table recreated with correct schema');
            }
        }
    } catch (error) {
        console.error('Error creating ContactMessages table:', error);
        throw error;
    }
};

const generateContactId = async () => {
    try {
        // Get the last contact_id from the database
        const [rows] = await pool.execute(
            'SELECT contact_id FROM ContactMessages ORDER BY contact_id DESC LIMIT 1'
        );

        if (rows.length === 0) {
            return 'C1001'; // First contact ID
        }

        // Extract the numeric part and increment
        const lastId = rows[0].contact_id;
        const numericPart = parseInt(lastId.substring(1));
        const newNumericPart = numericPart + 1;
        
        return `C${newNumericPart}`;
    } catch (error) {
        console.error('Error generating contact ID:', error);
        throw error;
    }
};

const storeContactMessage = async (contactData) => {
    try {
        await createContactTable();
        
        const { name, email, subject, message } = contactData;
        const contactId = await generateContactId();
        
        const [result] = await pool.execute(
            'INSERT INTO ContactMessages (contact_id, name, email, subject, message) VALUES (?, ?, ?, ?, ?)',
            [contactId, name, email, subject, message]
        );
        
        return {
            success: true,
            message: 'Contact message stored successfully',
            data: {
                contactId,
                ...contactData
            }
        };
    } catch (error) {
        console.error('Error storing contact message:', error);
        throw error;
    }
};

module.exports = {
    storeContactMessage
}; 