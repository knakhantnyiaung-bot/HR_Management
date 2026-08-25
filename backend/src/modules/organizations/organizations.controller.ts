import type { Request, Response } from "express";
import { requireAuthContext } from "@common/http/requestHelpers";
import { updateOrganizationSchema } from "@modules/organizations/organizations.schema";
import { getOrganization, updateOrganization } from "@modules/organizations/organizations.service";

export async function getOrganizationHandler(req: Request, res: Response): Promise<void> {
  const { organizationId } = requireAuthContext(req);
  const organization = await getOrganization(organizationId);
  res.json({ success: true, data: organization });
}

export async function updateOrganizationHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId } = requireAuthContext(req);
  const input = updateOrganizationSchema.parse(req.body);
  const organization = await updateOrganization(organizationId, input, userId);
  res.json({ success: true, data: organization });
}
