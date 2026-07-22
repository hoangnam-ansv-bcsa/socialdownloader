import { Router } from "express";
import {
  getSettingsController,
  updateSettingsController,
} from "../controllers/settingsController";

const router = Router();

router.get("/", getSettingsController);

router.post("/", updateSettingsController);

export default router;