import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import chalk from 'chalk';
import { aiService } from './services/aiService.js';
import { WebSocketHandler } from './services/WebSocketHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Configuration
const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const WS_PORT = HTTP_PORT + 1;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Initialize services
let wsHandler: WebSocketHandler;

async function initializeServer() {
    try {
        console.log(chalk.yellow('Starting server initialization...'));
        
        // Initialize AI Service
        await aiService.initialize();
        
        // Initialize WebSocket Handler
        wsHandler = new WebSocketHandler(WS_PORT);
        
        console.log(chalk.green('All services initialized successfully!'));
    } catch (error) {
        console.error(chalk.red('Failed to initialize server:'), error);
        process.exit(1);
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        aiServiceReady: aiService.isReady(),
        activeSessions: aiService.getSessionsCount(),
        activeConnections: wsHandler?.getConnectionsCount() || 0,
        websocketPort: WS_PORT,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(chalk.red('Express error:'), err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
async function startServer() {
    await initializeServer();
    
    app.listen(HTTP_PORT, () => {
        console.log(chalk.green(`HTTP Server running on http://localhost:${HTTP_PORT}`));
        console.log(chalk.blue(`WebSocket Server running on ws://localhost:${WS_PORT}`));
        console.log(chalk.yellow(`Open your browser and go to http://localhost:${HTTP_PORT}`));
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\nGracefully shutting down...'));
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\nGracefully shutting down...'));
    process.exit(0);
});

// Start the server
startServer().catch((error) => {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
});