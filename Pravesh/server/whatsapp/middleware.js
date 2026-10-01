// Wraps async route handlers so rejections become 500 JSON (no try/catch per route).
function asyncHandler(fn) {
  return (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((err) =>
      res.status(500).json({ success: false, error: err.message })
    );
}

module.exports = { asyncHandler };
