import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DB_PATH = path.join(__dirname, '..', 'db.json');

export interface DB {
    songs: any[];
    users: Record<string, any>;
    adminToken: any;
    settings: {
        downvotesEnabled: boolean;
        autoplayEnabled: boolean;
    };
    history: Record<string, any>;
    departments: string[];
    moderators: string[];
}

let dbCache: DB | null = null;

export function initializeDB() {
    if (!fs.existsSync(DB_PATH)) {
        dbCache = { 
            songs: [], 
            users: {}, 
            adminToken: null,
            settings: { downvotesEnabled: false, autoplayEnabled: false },
            history: {},
            departments: ['Entwicklung', 'Marketing', 'Vertrieb', 'Design', 'HR', 'Support'],
            moderators: []
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2));
    } else {
        try {
            dbCache = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        } catch (err) {
            console.error('Failed to load DB, resetting', err);
            dbCache = { songs: [], users: {}, adminToken: null, settings: { downvotesEnabled: false, autoplayEnabled: false }, history: {}, departments: [], moderators: [] };
        }
    }
}

export function getDB(): DB {
    if (!dbCache) {
        initializeDB();
    }
    return dbCache!;
}

export function saveDB(data: DB) {
    dbCache = data;
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to save database:', error);
    }
}
