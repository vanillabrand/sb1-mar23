import express from 'express';
import cors from 'cors';
import { config } from './config';
import { setupRoutes } from './routes';
import { initializeServices } from './services';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services before routes
await initializeServices();

// Setup routes after services are initialized
setupRoutes(app);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export { app };
