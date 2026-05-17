import './config.ts';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { initializeDB } from './db.ts';
import { setupRoutes } from './routes.ts';
import { checkAutoplay } from './spotify.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createHttpServer(app);
const io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

io.on('connection', (socket) => {
    console.log(`Socket Client connected: ${socket.id}. Total: ${io.engine.clientsCount}`);
    socket.on('disconnect', () => {
        console.log(`Socket Client disconnected: ${socket.id}. Remaining: ${io.engine.clientsCount}`);
    });
});

initializeDB();
setupRoutes(app, io);

// Poll for sync/autoplay every 2 seconds efficiently
async function pollLoop() {
    try {
        await checkAutoplay(io);
    } catch (err) {
        console.error('Poll Loop Error:', err);
    }
    setTimeout(pollLoop, 2000);
}
pollLoop();

async function start() {
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(__dirname, '..', 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

start();
