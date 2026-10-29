const jwt = require("jsonwebtoken");
const pool = require("./db");
const VALID_ROLES = new Set(["admin", "operator", "resident"]);

function createAuthenticateToken(database = pool, secretProvider = () => process.env.JWT_SECRET) {
  return function authenticateToken(req, res, next) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
    if (!match) {
      return res.status(401).json({ error: "Access token required" });
    }
    const secret = secretProvider();
    if (!secret) {
      return res.status(503).json({ error: "Authentication is not configured" });
    }

    jwt.verify(match[1], secret, async (err, user) => {
      if (err) {
        return res.status(401).json({ error: "Invalid token" });
      }
      if (!VALID_ROLES.has(user.role)) {
        return res.status(403).json({ error: "Unrecognized role" });
      }
      try {
        const result = await database.query(
          `SELECT u.username, u.role, u.active, z.zone_code AS assigned_zone
             FROM users u
             LEFT JOIN operational_zones z ON z.zone_code = u.assigned_zone
            WHERE u.id=$1`,
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
  };
}

const authenticateToken = createAuthenticateToken();
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
  createAuthenticateToken,
  authMiddleware,
  requireRole,
  requireAnyRole,
  VALID_ROLES,
};
