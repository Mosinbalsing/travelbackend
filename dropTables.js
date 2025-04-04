const { dropUserColumns, dropUserTable } = require('./src/utils/dbUtils');

async function main() {
    try {
        console.log('Starting database cleanup...');
        
        // Drop the user table and recreate it with the correct schema
        console.log('Dropping and recreating user table...');
        await dropUserTable();
        
        console.log('✅ Database cleanup completed successfully!');
        console.log('The user table has been recreated with the following schema:');
        console.log('  - user_id (INT, PRIMARY KEY)');
        console.log('  - name (VARCHAR)');
        console.log('  - email (VARCHAR, UNIQUE)');
        console.log('  - mobile (VARCHAR, UNIQUE)');
        console.log('  - created_at (TIMESTAMP)');
        console.log('  - updated_at (TIMESTAMP)');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main(); 