const jwt = require("jsonwebtoken");
const pool = require("./db");
const VALID_ROLES = new Set(["admin", "operator", "resident"]);

function authenticateToken(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
  if (!match) {
    return res.status(401).json({ error: "Access token required" });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ error: "Authentication is not configured" });
  }

  jwt.verify(match[1], process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (!VALID_ROLES.has(user.role)) {
      return res.status(403).json({ error: "Unrecognized role" });
    }
    try {
      const result = await pool.query(
        "SELECT username, role, assigned_zone, active FROM users WHERE id=$1",
        [user.user_id],
      );
      const account = result.rows[0];
      if (
        !account ||
        account.active === false ||
        account.role !== user.role ||
        account.username !== user.username
      ) {
        return res.status(403).json({ error: "Account is inactive or changed" });
      }
      req.user = { ...user, assigned_zone: account.assigned_zone || null };
      next();
    } catch (error) {
      console.error("Authentication account lookup failed", error);
      res.status(503).json({ error: "Authentication service unavailable" });
    }
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
