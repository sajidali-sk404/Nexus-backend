// ── Role Check: Allow specific roles only ──────────────────────────
// Usage: router.get('/investor-only', protect, roleCheck('investor'), handler)
// Usage: router.get('/both', protect, roleCheck('investor', 'entrepreneur'), handler)

export const roleCheck = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated. Please login first.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This route is for: ${allowedRoles.join(", ")} only.`,
      });
    }

    next();
  };
};

// ── Owner Check: Only resource owner can access ────────────────────
// Call after protect middleware; compares req.user._id with a userId param
export const ownerCheck = (req, res, next) => {
  const paramId = req.params.userId || req.params.id;

  if (!paramId) return next(); // no param to check

  if (req.user._id.toString() !== paramId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Access denied. You can only access your own resources.",
    });
  }

  next();
};


