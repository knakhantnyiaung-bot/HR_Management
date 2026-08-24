import { Router } from "express";
import { requireAuth } from "@common/auth/requireAuth";
import { login, me } from "@modules/auth/auth.controller";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/me", requireAuth, me);
