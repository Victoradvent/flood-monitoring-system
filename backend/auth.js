const jwt = require("jsonwebtoken");
const VALID_ROLES = new Set(["admin", "operator", "resident"]);

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET || "dev-secret", (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    if (!VALID_ROLES.has(user.role)) {
      return res.status(403).json({ error: "Unrecognized role" });
    }
    req.user = user;
    next();
  });
}

const authMiddleware = authenticateToken;

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

function requireAnyRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  authMiddleware,
  requireRole,
  requireAnyRole,
  VALID_ROLES,
};
