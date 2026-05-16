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

export function initializeDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ 
            songs: [], 
            users: {}, 
            adminToken: null,
            settings: { downvotesEnabled: false, autoplayEnabled: false },
            history: {},
            departments: ['Entwicklung', 'Marketing', 'Vertrieb', 'Design', 'HR', 'Support'],
            moderators: []
        }));
    }
}

export function getDB(): DB {
    try {
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        if (!data.adminToken) data.adminToken = null;
        if (!data.songs) data.songs = [];
        if (!data.users) data.users = {};
        if (!data.settings) data.settings = { downvotesEnabled: false, autoplayEnabled: false };
        if (!data.history) data.history = {};
        if (!data.departments) data.departments = ['Entwicklung', 'Marketing', 'Vertrieb', 'Design', 'HR', 'Support'];
        if (!data.moderators) data.moderators = [];
        return data;
    } catch (error) {
        console.error('Failed to read or parse database:', error);
        return { 
            songs: [], 
            users: {}, 
            adminToken: null, 
            settings: { downvotesEnabled: false, autoplayEnabled: false }, 
            history: {}, 
            departments: ['Entwicklung', 'Marketing', 'Vertrieb', 'Design', 'HR', 'Support'],
            moderators: [] 
        };
    }
}

export function saveDB(data: DB) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to save database:', error);
    }
}
