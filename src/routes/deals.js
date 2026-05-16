import express from "express";
import { createDeal, getDeal, getMyDeals, getDeals, updateDeal , deleteDeal } from "../controllers/deals.js";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";

const router = express.Router();

// ────────────────────────────────────────────────────────────────────


router.post("/", protect, roleCheck("investor"), createDeal);
router.get("/my-deals", protect, roleCheck("entrepreneur"), getMyDeals);
router.get("/", protect, roleCheck("investor"), getDeals);
router.get("/:id", protect, getDeal);
router.put("/:id", protect, roleCheck("investor"), updateDeal);
router.delete("/:id", protect, roleCheck("investor"), deleteDeal);

export default router;