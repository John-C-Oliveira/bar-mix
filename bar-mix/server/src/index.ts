import express from 'express';
import { json } from 'body-parser';
import { setupRoutes } from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(json());
setupRoutes(app);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});