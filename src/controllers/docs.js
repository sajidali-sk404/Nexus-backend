import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Document from "../models/Document.js";
import { uploadToCloudinary , deleteFromCloudinary } from "../lib/cloudinary.js";

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/docs/upload
// @desc    Upload a document
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const uploadDocument = async (req, res) => {
  try {
    console.log(req.file); // debug

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    const {
      title,
      category,
      description,
      requiresSignature,
      tags,
    } = req.body;

    // upload to cloudinary
    const uploadedFile = await uploadToCloudinary({
      ...req.file,
      folder: "documents",
    });

    const doc = await Document.create({
      title: title || req.file.originalname,
      fileName: req.file.originalname,
      fileUrl: uploadedFile.url,
      cloudinaryPublicId: uploadedFile.public_id,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      category: category || "other",
      description: description || "",
      requiresSignature: requiresSignature === "true",
      tags: tags
        ? tags.split(",").map((t) => t.trim())
        : [],
    });

    await doc.populate(
      "uploadedBy",
      "name email profilePic"
    );

    res.status(201).json({
      success: true,
      document: doc,
    });
  } catch (error) {
    console.error("Upload error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Upload failed.",
    });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/docs
// @desc    Get all documents for logged-in user
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const getDocuments = async (req, res) => {
  try {
    const { category, status } = req.query;

    const filter = {
      $or: [
        { uploadedBy: req.user._id },
        { "sharedWith.user": req.user._id },
      ],
    };

    if (category) filter.category = category;
    if (status) filter.status = status;

    const documents = await Document.find(filter)
      .populate("uploadedBy", "name email profilePic")
      .populate("sharedWith.user", "name email profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: documents.length, documents });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   GET /api/docs/:id
// @desc    Get a single document
// @access  Private (owner or shared users)
// ────────────────────────────────────────────────────────────────────
export const getDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate("uploadedBy", "name email profilePic")
      .populate("sharedWith.user", "name email profilePic")
      .populate("signatures.signedBy", "name email profilePic");

    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });

    const hasAccess =
      doc.uploadedBy._id.toString() === req.user._id.toString() ||
      doc.sharedWith.some((s) => s.user._id.toString() === req.user._id.toString());

    if (!hasAccess) return res.status(403).json({ success: false, message: "Access denied." });

    res.status(200).json({ success: true, document: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/docs/:id/share
// @desc    Share a document with another user
// @access  Private (owner only)
// ────────────────────────────────────────────────────────────────────
export const shareDocument = async (req, res) => {
  try {
    const { userId, permission } = req.body;
    const doc = await Document.findById(req.params.id);

    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });
    if (doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Only the owner can share." });
    }

    // Check if already shared
    const alreadyShared = doc.sharedWith.find((s) => s.user.toString() === userId);
    if (alreadyShared) {
      alreadyShared.permission = permission || "view";
    } else {
      doc.sharedWith.push({ user: userId, permission: permission || "view" });
    }

    if (permission === "sign") {
      doc.status = "pending-signature";
    }

    await doc.save();
    await doc.populate("sharedWith.user", "name email profilePic");

    res.status(200).json({ success: true, document: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   POST /api/docs/:id/sign
// @desc    E-sign a document (save base64 signature image)
// @access  Private (shared with 'sign' permission)
// ────────────────────────────────────────────────────────────────────
export const signDocument = async (req, res) => {
  try {
    const { signatureImage } = req.body;

    if (!signatureImage) {
      return res.status(400).json({ success: false, message: "Signature image is required." });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Document not found." });

    // Check signing permission
    const sharedEntry = doc.sharedWith.find((s) => s.user.toString() === req.user._id.toString());
    const isOwner = doc.uploadedBy.toString() === req.user._id.toString();

    if (!isOwner && (!sharedEntry || sharedEntry.permission !== "sign")) {
      return res.status(403).json({ success: false, message: "You don't have permission to sign." });
    }

    // Check if already signed by this user
    const alreadySigned = doc.signatures.find((s) => s.signedBy.toString() === req.user._id.toString());
    if (alreadySigned) {
      return res.status(400).json({ success: false, message: "You have already signed this document." });
    }

    doc.signatures.push({
      signedBy: req.user._id,
      signatureImage,
      ipAddress: req.ip,
    });

    // Check if all required signatures are complete
    const signersNeeded = doc.sharedWith.filter((s) => s.permission === "sign").length + 1; // +1 for owner
    if (doc.signatures.length >= signersNeeded) {
      doc.status = "signed";
      doc.allSignaturesComplete = true;
    }

    await doc.save();

    res.status(200).json({ success: true, message: "Document signed successfully.", document: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ────────────────────────────────────────────────────────────────────
// @route   DELETE /api/docs/:id
// @desc    Delete a document (owner only)
// @access  Private
// ────────────────────────────────────────────────────────────────────
export const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    // Only owner can delete
    if (doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the owner can delete.",
      });
    }

    // Delete file from Cloudinary
    if (doc.cloudinaryPublicId) {
      await deleteFromCloudinary({
        publicId: doc.cloudinaryPublicId,
        resourceType:
          doc.fileType === "application/pdf"
            ? "raw"
            : "image",
      });
    }

    // Delete DB document
    await doc.deleteOne();

    res.status(200).json({
      success: true,
      message: "Document deleted successfully.",
    });

  } catch (error) {
    console.error("Delete document error:", error);

    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};


