export type AssetCategory = "LAPTOP" | "MONITOR" | "PHONE" | "PERIPHERAL" | "FURNITURE" | "OTHER";
export type AssetStatus = "AVAILABLE" | "ASSIGNED" | "IN_REPAIR" | "RETIRED";

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  serialNumber: string | null;
  notes: string | null;
  status: AssetStatus;
  currentEmployee: { id: string; employeeNo: string; user: { email: string } } | null;
  createdAt: string;
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  employeeId: string;
  assignedAt: string;
  assignedBy: string;
  returnedAt: string | null;
  returnedBy: string | null;
  notes: string | null;
}
