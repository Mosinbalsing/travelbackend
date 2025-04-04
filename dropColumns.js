const { dropUserColumns } = require('./src/utils/dbUtils');

async function main() {
    try {
        await dropUserColumns();
        console.log('✅ All columns dropped successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main(); 