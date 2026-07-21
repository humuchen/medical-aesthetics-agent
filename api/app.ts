import express from "express";

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", from: "app.ts" });
});

app.get("/api/check-login", (req, res) => {
  res.json({ isLoggedIn: false, method: "none" });
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server on ${PORT}`));
}

export default app;
