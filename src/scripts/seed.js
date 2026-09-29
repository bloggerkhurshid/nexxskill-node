import { initDatabase, pool } from '../config/db.js';

console.log('Starting NexxSkill Database initialization & seed...');
await initDatabase();
console.log('Seeding completed successfully!');
await pool.end();
process.exit(0);
