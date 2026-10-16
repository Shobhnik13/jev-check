import {db, initDb} from '@/configs/config';

await initDb();
await db.destroy();
console.log('Schema applied');
