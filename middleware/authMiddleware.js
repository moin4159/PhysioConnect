function verifyRequest(req, res, next) {
  // We pass user session ID in request headers 'x-user-id'
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  }
  req.userId = userId;
  next();
}

module.exports = verifyRequest;
