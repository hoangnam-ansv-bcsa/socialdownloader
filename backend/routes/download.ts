import { Router } from "express";
import { downloadVideo } from "../services/downloadService";
import { addTask, getQueue } from "../services/queueService";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing urls array",
      });
    }

    const tasks = [];

    for (const url of urls) {
      const task = addTask(url);
      tasks.push(task);
    }

    res.json({
      success: true,
      message: `${tasks.length} task(s) added to queue`,
      tasks,
    });

  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get("/queue", (req, res) => {
  res.json(getQueue());
});

export default router;