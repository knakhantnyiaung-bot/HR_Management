export type OrgStructureStatus = "ACTIVE" | "INACTIVE";

export interface Department {
  id: string;
  name: string;
  status: OrgStructureStatus;
}

export interface Position {
  id: string;
  departmentId: string;
  title: string;
  status: OrgStructureStatus;
}
