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

export interface Organization {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  payrollCycle: string;
  status: string;
}
