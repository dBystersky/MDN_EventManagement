export type Member = { memberId: number; name: string; email: string };

export type Resource = {
  resourceId: number;
  name: string;
  resourceTypeRel?: { name: string };
};

export type Task = {
  taskId: number;
  name: string;
  eventId?: number | null;
  budget?: string | null;
  deadline?: string;
  taskManagers?: { memberId: number; member?: Member }[];
  bookable?: {
    resourceAllocations?: { resourceId: number; resource?: { name: string } }[];
  };
};

export type Location = { locationId: number; name: string };

export type EventItem = {
  eventId: number;
  name: string;
  description?: string | null;
  date: string;
  location?: { locationId: number; name: string };
  totalBudget?: string;
  tasks?: Task[];
  eventManagers?: { memberId: number; member?: Member }[];
  bookable?: {
    resourceAllocations?: { resourceId: number; resource?: { name: string } }[];
  };
};

/** Local-only rows until Create/Update persists them as Task records. */
export type DraftSubtask = {
  key: string;
  name: string;
  assigneeId: string;
  deadline: string;
  resourceIds: string[];
};

export type Option = { id: string; label: string };
