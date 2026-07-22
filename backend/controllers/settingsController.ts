import { Request, Response } from "express";
import { getSettings, saveSettings } from "../../server_db";

export function getSettingsController(
  req: Request,
  res: Response
) {
  res.json(getSettings());
}

export function updateSettingsController(
  req: Request,
  res: Response
) {
  const settings = req.body;

  saveSettings(settings);

  res.json({
    success: true,
    settings,
  });
}