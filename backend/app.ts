import express from "express";
import downloadRouter from "./routes/download";

import { startWorkers } from "./services/workerManager";
const app = express();

app.use(express.json());

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Universal Social Downloader Backend",
    version: "0.1.0",
  });
});

// Download API
app.use("/api/download", downloadRouter);

// Khởi động worker
startWorkers();
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});