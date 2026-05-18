import express from "express";
import {
  createDeal,
  getDeals,
  getDeal,
  updateDeal,
  updateDealStatus,
  addDealNote,
  deleteDeal,
} from "../controllers/deals.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createDeal);
router.get("/", protect, getDeals);
router.get("/:id", protect, getDeal);
router.put("/:id", protect, updateDeal);
router.put("/:id/status", protect, updateDealStatus);
router.post("/:id/notes", protect, addDealNote);
router.delete("/:id", protect, deleteDeal);

export default router;