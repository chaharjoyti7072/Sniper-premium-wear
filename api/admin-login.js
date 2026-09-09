module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const { password } = req.body || {};

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({
      error: "ADMIN_PASSWORD is not configured in Vercel"
    });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({
      error: "Wrong password"
    });
  }

  return res.status(200).json({
    ok: true
  });
};
