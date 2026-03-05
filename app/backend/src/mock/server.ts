import express from "express";
import { mockLatestReading, mockReadings, mockRecommendation, mockAlerts } from "./data";

const app = express();
app.use(express.json());

app.get("/api/v1/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/v1/auth/login", (_req, res) => {
  res.json({ accessToken: "demo-access", refreshToken: "demo-refresh", user: { id: "u1", email: "demo@demo.com" } });
});

app.post("/api/v1/auth/register", (_req, res) => {
  res.status(201).json({ accessToken: "demo-access", refreshToken: "demo-refresh", user: { id: "u1", email: "demo@demo.com" } });
});

app.post("/api/v1/auth/google", (_req, res) => {
  res.json({ accessToken: "demo-access", refreshToken: "demo-refresh", user: { id: "u1", email: "demo@demo.com" } });
});

app.post("/api/v1/auth/refresh", (_req, res) => {
  res.json({ accessToken: "demo-access", refreshToken: "demo-refresh", user: { id: "u1", email: "demo@demo.com" } });
});

app.get("/api/v1/readings/latest", (_req, res) => {
  const latest = mockLatestReading();
  if (!latest) {
    res.status(204).end();
    return;
  }
  res.json(latest);
});

app.get("/api/v1/readings", (_req, res) => {
  res.json(mockReadings(24));
});

app.get("/api/v1/recommendations/latest", (_req, res) => {
  const latest = mockLatestReading();
  const rec = latest ? mockRecommendation(latest) : null;
  if (!rec) {
    res.status(204).end();
    return;
  }
  res.json(rec);
});

app.get("/api/v1/alerts", (_req, res) => {
  res.json(mockAlerts());
});

app.post("/api/v1/notifications/register", (req, res) => {
  res.json({
    id: "pt1",
    userId: "u1",
    token: req.body?.token || "expo-token",
    platform: req.body?.platform || "android",
    deviceId: req.body?.deviceId || "demo-device",
    createdAt: new Date().toISOString(),
  });
});

app.post("/api/v1/notifications/test", (_req, res) => {
  res.json({ ok: true });
});

app.listen(3001, () => {
  console.log("Mock server running at http://localhost:3001");
});
