import express from "express";

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", from: "inline" });
});

app.get("/api/check-login", (req, res) => {
  res.json({ isLoggedIn: false, method: "none" });
});

export default app;
